import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createProfileStat,
  deleteProfileStat,
  listProfileStatsAdmin,
  updateProfileStat,
} from "../supabase/admin-profile-stats";
import type { Database, ProfileStatRow } from "../supabase/database";

type TypedClient = SupabaseClient<Database>;
const asClient = (client: unknown): TypedClient =>
  client as unknown as TypedClient;

// Seam (adapter): admin stat CRUD with injected client, mirroring
// admin-testimonials. Catches wrong table/payload and swallowed errors.
// Misses live RLS behavior.
function rowResult(data: unknown, error: { message: string } | null = null) {
  return { data, error };
}

const STAT_PAYLOAD = {
  value: "10+ Tahun",
  label: "Pengalaman",
  sort: 0,
  visible: true,
};

describe("listProfileStatsAdmin", () => {
  it("lists all stats ordered by sort (including hidden)", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const rows: ProfileStatRow[] = [
      { ...STAT_PAYLOAD, id: "1" },
      { ...STAT_PAYLOAD, id: "2", visible: false },
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
    await expect(listProfileStatsAdmin(asClient(client))).resolves.toEqual(rows);
    expect(calls).toContainEqual(["from", "profile_stats"]);
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
    await expect(listProfileStatsAdmin(asClient(client))).rejects.toThrow(
      /db down/,
    );
  });
});

describe("createProfileStat", () => {
  it("inserts the validated payload and returns the row", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const row = { ...STAT_PAYLOAD, id: "9" };
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
      createProfileStat(asClient(client), STAT_PAYLOAD),
    ).resolves.toEqual(row);
    expect(calls).toContainEqual(["from", "profile_stats"]);
    expect(calls).toContainEqual(["insert", STAT_PAYLOAD]);
  });

  it("propagates insert errors instead of pretending the row saved", async () => {
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
      createProfileStat(asClient(client), STAT_PAYLOAD),
    ).rejects.toThrow(/rls denied/);
  });
});

describe("updateProfileStat", () => {
  it("updates the row by id and returns it", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const row = { ...STAT_PAYLOAD, id: "1", value: "Revisi." };
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
      updateProfileStat(asClient(client), "1", { value: "Revisi." }),
    ).resolves.toEqual(row);
    expect(calls).toContainEqual(["eq", "id", "1"]);
  });
});

describe("deleteProfileStat", () => {
  it("deletes the row by id", async () => {
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
    };
    await deleteProfileStat(asClient(client), "1");
    expect(calls).toContainEqual(["from", "profile_stats"]);
    expect(calls).toContainEqual(["eq", "id", "1"]);
  });

  it("throws when the row delete fails", async () => {
    const client = {
      from: () => ({
        delete: () => ({
          eq: async () => rowResult(null, { message: "rls denied" }),
        }),
      }),
    };
    await expect(deleteProfileStat(asClient(client), "1")).rejects.toThrow(
      /rls denied/,
    );
  });
});
