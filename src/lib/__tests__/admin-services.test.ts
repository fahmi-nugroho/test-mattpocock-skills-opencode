import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createService,
  deleteService,
  listServicesAdmin,
  updateService,
} from "../supabase/admin-services";
import type { Database, Service } from "../supabase/database";

type TypedClient = SupabaseClient<Database>;
const asClient = (client: unknown): TypedClient =>
  client as unknown as TypedClient;

// Seam 2 (adapter): admin price/service CRUD with injected client.
// Catches wrong table/filter/payload and swallowed errors.
// Misses live RLS behavior.
function rowResult(data: unknown, error: { message: string } | null = null) {
  return { data, error };
}

const SERVICE_PAYLOAD = {
  name: "Makeup Wisuda",
  description: "Rias natural",
  price_idr: 500000,
  duration_min: 120,
  active: true,
  cover_image_url: null as string | null,
  sort: 0,
};

describe("listServicesAdmin", () => {
  it("lists all services ordered by sort (including inactive)", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const rows: Service[] = [
      { ...SERVICE_PAYLOAD, id: "1", cover_image_url: null },
      { ...SERVICE_PAYLOAD, id: "2", active: false, cover_image_url: null },
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
    await expect(listServicesAdmin(asClient(client))).resolves.toEqual(rows);
    expect(calls).toContainEqual(["from", "services"]);
    expect(calls).toContainEqual(["order", "sort", { ascending: true }]);
  });

  it("throws instead of rendering stale prices on error", async () => {
    const client = {
      from: () => ({
        select: () => ({
          order: async () => rowResult(null, { message: "db down" }),
        }),
      }),
    };
    await expect(listServicesAdmin(asClient(client))).rejects.toThrow(/db down/);
  });
});

describe("createService", () => {
  it("inserts the validated payload and returns the row", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const row = { ...SERVICE_PAYLOAD, id: "9" };
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
      createService(asClient(client), SERVICE_PAYLOAD),
    ).resolves.toEqual(row);
    expect(calls).toContainEqual(["from", "services"]);
    expect(calls).toContainEqual(["insert", SERVICE_PAYLOAD]);
  });

  it("propagates insert errors instead of pretending the price saved", async () => {
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
      createService(asClient(client), SERVICE_PAYLOAD),
    ).rejects.toThrow(/rls denied/);
  });
});

describe("updateService", () => {
  it("updates the row by id and returns it", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const row = { ...SERVICE_PAYLOAD, id: "1", price_idr: 600000 };
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
      updateService(asClient(client), "1", { price_idr: 600000 }),
    ).resolves.toEqual(row);
    expect(calls).toContainEqual(["eq", "id", "1"]);
  });
});

describe("deleteService", () => {
  it("deletes the row and cleans up its cover image", async () => {
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
    await deleteService(
      asClient(client),
      "1",
      "https://xyz.supabase.co/storage/v1/object/public/prices/cover.jpg",
    );
    expect(calls).toContainEqual(["from", "services"]);
    expect(calls).toContainEqual(["eq", "id", "1"]);
    expect(calls).toContainEqual(["storage.from", "prices"]);
    expect(calls).toContainEqual(["remove", ["cover.jpg"]]);
  });

  it("skips storage cleanup when the service has no cover", async () => {
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
    await deleteService(asClient(client), "1", null);
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
    await expect(deleteService(asClient(client), "1", null)).rejects.toThrow(
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
      deleteService(
        asClient(storageOk),
        "1",
        "https://xyz.supabase.co/storage/v1/object/public/prices/cover.jpg",
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
      deleteService(
        asClient(storageFail),
        "1",
        "https://xyz.supabase.co/storage/v1/object/public/prices/cover.jpg",
      ),
    ).resolves.toEqual({ cleanupOk: false });
  });
});
