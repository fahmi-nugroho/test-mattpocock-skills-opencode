import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createPortfolioItem,
  deletePortfolioItem,
  listPortfolioItemsAdmin,
  updatePortfolioItem,
} from "../supabase/admin-portfolio";
import type { Database, PortfolioItem } from "../supabase/database";

type TypedClient = SupabaseClient<Database>;
const asClient = (client: unknown): TypedClient =>
  client as unknown as TypedClient;

// Seam 2 (adapter): admin portfolio CRUD with injected client.
// Catches wrong table/filter/payload and swallowed errors.
// Misses live RLS behavior.
function rowResult(data: unknown, error: { message: string } | null = null) {
  return { data, error };
}

describe("listPortfolioItemsAdmin", () => {
  it("lists all portfolio items ordered by sort (including hidden)", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const rows: PortfolioItem[] = [
      { id: "1", title: "A", category: "W", image_url: "u", sort: 0, visible: false },
      { id: "2", title: "B", category: "W", image_url: "v", sort: 1, visible: true },
    ];
    const builder: Record<string, unknown> = {};
    builder.order = (col: string, opts: unknown) => {
      calls.push(["order", col, opts]);
      return Promise.resolve(rowResult(rows));
    };
    const client = {
      from: (table: string) => {
        calls.push(["from", table]);
        return {
          select: (cols: string) => {
            calls.push(["select", cols]);
            return builder;
          },
        };
      },
    };
    await expect(listPortfolioItemsAdmin(asClient(client))).resolves.toEqual(rows);
    expect(calls).toContainEqual(["from", "portfolio_items"]);
    expect(calls).toContainEqual(["order", "sort", { ascending: true }]);
  });

  it("throws instead of rendering a stale list on error", async () => {
    const client = {
      from: () => ({
        select: () => ({
          order: async () => rowResult(null, { message: "db down" }),
        }),
      }),
    };
    await expect(listPortfolioItemsAdmin(asClient(client))).rejects.toThrow(
      /db down/,
    );
  });
});

describe("createPortfolioItem", () => {
  it("inserts the validated payload and returns the row", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const row = { id: "9", title: "T", category: "C", image_url: "u", sort: 0, visible: true };
    const client = {
      from: (table: string) => {
        calls.push(["from", table]);
        return {
          insert: (values: unknown) => {
            calls.push(["insert", values]);
            return {
              select: () => ({
                single: async () => rowResult(row),
              }),
            };
          },
        };
      },
    };
    await expect(
      createPortfolioItem(asClient(client), {
        title: "T",
        category: "C",
        image_url: "u",
        sort: 0,
        visible: true,
      }),
    ).resolves.toEqual(row);
    expect(calls).toContainEqual(["from", "portfolio_items"]);
  });

  it("propagates insert errors instead of pretending the tile saved", async () => {
    const client = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => rowResult(null, { message: "rls denied" }),
          }),
        }),
      }),
    };
    await expect(
      createPortfolioItem(asClient(client), {
        title: "T",
        category: "C",
        image_url: "u",
        sort: 0,
        visible: true,
      }),
    ).rejects.toThrow(/rls denied/);
  });
});

describe("updatePortfolioItem", () => {
  it("updates the row by id and returns it", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const row = { id: "1", title: "New" };
    const client = {
      from: (table: string) => {
        calls.push(["from", table]);
        return {
          update: (values: unknown) => {
            calls.push(["update", values]);
            return {
              eq: (col: string, val: unknown) => {
                calls.push(["eq", col, val]);
                return {
                  select: () => ({
                    single: async () => rowResult(row),
                  }),
                };
              },
            };
          },
        };
      },
    };
    await expect(
      updatePortfolioItem(asClient(client), "1", { title: "New" }),
    ).resolves.toEqual(row);
    expect(calls).toContainEqual(["eq", "id", "1"]);
  });
});

describe("deletePortfolioItem", () => {
  it("deletes the row and cleans up its storage object", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const client = {
      from: (table: string) => {
        calls.push(["from", table]);
        return {
          delete: () => ({
            eq: (col: string, val: unknown) => {
              calls.push(["eq", col, val]);
              return Promise.resolve(rowResult(null));
            },
          }),
        };
      },
      storage: {
        from: (bucket: string) => {
          calls.push(["storage.from", bucket]);
          return {
            remove: async (paths: string[]) => {
              calls.push(["remove", paths]);
              return { data: paths, error: null };
            },
          };
        },
      },
    };
    await deletePortfolioItem(
      asClient(client),
      "1",
      "https://xyz.supabase.co/storage/v1/object/public/portfolio/abc.jpg",
    );
    expect(calls).toContainEqual(["from", "portfolio_items"]);
    expect(calls).toContainEqual(["eq", "id", "1"]);
    expect(calls).toContainEqual(["storage.from", "portfolio"]);
    expect(calls).toContainEqual(["remove", ["abc.jpg"]]);
  });

  it("skips storage cleanup when the item has no stored image", async () => {
    let removeCalls = 0;
    const client = {
      from: () => ({
        delete: () => ({
          eq: async () => rowResult(null),
        }),
      }),
      storage: {
        from: () => ({
          remove: async () => {
            removeCalls += 1;
            return { data: [], error: null };
          },
        }),
      },
    };
    await deletePortfolioItem(asClient(client), "1", null);
    expect(removeCalls).toBe(0);
  });

  it("throws when the row delete fails", async () => {
    const client = {
      from: () => ({
        delete: () => ({
          eq: async () => rowResult(null, { message: "rls denied" }),
        }),
      }),
      storage: { from: () => ({ remove: async () => ({ data: [], error: null }) }) },
    };
    await expect(deletePortfolioItem(asClient(client), "1", null)).rejects.toThrow(
      /rls denied/,
    );
  });

  it("reports cleanupOk so the UI can warn about orphaned objects", async () => {
    const storageOk = {
      from: () => ({
        delete: () => ({
          eq: async () => rowResult(null),
        }),
      }),
      storage: { from: () => ({ remove: async () => ({ data: ["a"], error: null }) }) },
    };
    await expect(
      deletePortfolioItem(
        asClient(storageOk),
        "1",
        "https://xyz.supabase.co/storage/v1/object/public/portfolio/abc.jpg",
      ),
    ).resolves.toEqual({ cleanupOk: true });
    const storageFail = {
      from: () => ({
        delete: () => ({
          eq: async () => rowResult(null),
        }),
      }),
      storage: {
        from: () => ({
          remove: async () => ({ data: null, error: { message: "denied" } }),
        }),
      },
    };
    await expect(
      deletePortfolioItem(
        asClient(storageFail),
        "1",
        "https://xyz.supabase.co/storage/v1/object/public/portfolio/abc.jpg",
      ),
    ).resolves.toEqual({ cleanupOk: false });
  });
});
