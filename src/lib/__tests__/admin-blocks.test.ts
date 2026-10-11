import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createBlock,
  deleteBlock,
  listBlocksAdmin,
  updateBlock,
} from "../supabase/admin-blocks";
import type { Database } from "../supabase/database";

type TypedClient = SupabaseClient<Database>;
const asClient = (client: unknown): TypedClient =>
  client as unknown as TypedClient;

function ok(data: unknown) {
  return { data, error: null };
}

// Seam 2 (adapter): admin block CRUD + confirmed-booking guard.
// Catches wrong table/payload and missing guard wiring.
// Misses live RLS behavior.
function blockClient(opts: {
  blockRow?: unknown;
  sameDayBookings?: unknown[];
  inserted?: unknown;
  updated?: unknown;
  calls?: Array<[string, ...unknown[]]>;
}) {
  const calls = opts.calls ?? [];
  const client = {
    from: (table: string) => {
      calls.push(["from", table]);
      return {
        select: (cols: string) => {
          calls.push([`${table}.select`, cols]);
          const chain: Record<string, unknown> = {};
          chain.eq = (col: string, val: unknown) => {
            calls.push([`${table}.eq`, col, val]);
            if (table === "bookings") {
              return Promise.resolve(ok(opts.sameDayBookings ?? []));
            }
            if (col === "id") {
              return { single: async () => ok(opts.blockRow) };
            }
            return Promise.resolve(ok([]));
          };
          chain.order = (col: string, o: unknown) => {
            calls.push([`${table}.order`, col, o]);
            return Promise.resolve(ok([]));
          };
          return chain;
        },
        insert: (values: unknown) => {
          calls.push(["insert", values]);
          return { select: () => ({ single: async () => ok(opts.inserted ?? values) }) };
        },
        update: (values: unknown) => {
          calls.push(["update", values]);
          return {
            eq: () => ({
              select: () => ({ single: async () => ok(opts.updated ?? values) }),
            }),
          };
        },
        delete: () => ({
          eq: (col: string, val: unknown) => {
            calls.push(["delete.eq", col, val]);
            return Promise.resolve(ok(null));
          },
        }),
      };
    },
  };
  return { client: asClient(client), calls };
}

describe("listBlocksAdmin", () => {
  it("lists blocks ordered by date then start time", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const rows = [{ id: "1", date: "2026-10-12", all_day: true }];
    const client = {
      from: (table: string) => {
        calls.push(["from", table]);
        return {
          select: (cols: string) => {
            calls.push(["select", cols]);
            return {
              order: (col: string, o: unknown) => {
                calls.push(["order1", col, o]);
                return {
                  order: (col2: string, o2: unknown) => {
                    calls.push(["order2", col2, o2]);
                    return Promise.resolve(ok(rows));
                  },
                };
              },
            };
          },
        };
      },
    };
    await expect(listBlocksAdmin(asClient(client))).resolves.toEqual(rows);
    expect(calls).toContainEqual(["from", "blocks"]);
    expect(calls).toContainEqual(["order1", "date", { ascending: true }]);
  });
});

describe("createBlock", () => {
  it("inserts a block when no confirmed booking shares the date", async () => {
    const { client, calls } = blockClient({ inserted: { id: "9" } });
    await expect(
      createBlock(client, {
        date: "2026-10-12",
        all_day: true,
        start_time: null,
        end_time: null,
        reason: "Libur",
      }),
    ).resolves.toMatchObject({ id: "9" });
    expect(calls).toContainEqual(["from", "blocks"]);
  });

  it("rejects a block over a confirmed booking with a message", async () => {
    const { client } = blockClient({
      sameDayBookings: [
        {
          id: "b1",
          date: "2026-10-12",
          start_time: "09:00",
          end_time: "10:00",
          status: "confirmed",
        },
      ],
    });
    await expect(
      createBlock(client, {
        date: "2026-10-12",
        all_day: true,
        start_time: null,
        end_time: null,
        reason: "Libur",
      }),
    ).rejects.toThrow(/bentrok/i);
  });
});

describe("updateBlock", () => {
  it("rejects an edit that would cover a confirmed booking", async () => {
    const { client } = blockClient({
      blockRow: {
        id: "k1",
        date: "2026-10-12",
        all_day: false,
        start_time: "15:00",
        end_time: "16:00",
        reason: "",
      },
      sameDayBookings: [
        {
          id: "b1",
          date: "2026-10-12",
          start_time: "09:00",
          end_time: "10:00",
          status: "confirmed",
        },
      ],
    });
    await expect(
      updateBlock(client, "k1", { all_day: true }),
    ).rejects.toThrow(/bentrok/i);
  });
});

describe("deleteBlock", () => {
  it("deletes by id", async () => {
    const { client, calls } = blockClient({});
    await expect(deleteBlock(client, "k1")).resolves.toBeUndefined();
    expect(calls).toContainEqual(["delete.eq", "id", "k1"]);
  });
});
