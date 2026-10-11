import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOverviewBookings } from "../supabase/admin-overview";
import type { Database } from "../supabase/database";

type TypedClient = SupabaseClient<Database>;
const asClient = (client: unknown): TypedClient =>
  client as unknown as TypedClient;

// Seam 3b (adapter): overview bookings read with injected client.
// Catches wrong table/filter/order and swallowed errors.
// Misses live RLS behavior.
describe("getOverviewBookings", () => {
  function fakeClient(result: {
    data: unknown;
    error: { message: string } | null;
  }) {
    const calls: Array<[string, ...unknown[]]> = [];
    const orderStep = {
      order: (col: string, opts: unknown) => {
        calls.push(["order", col, opts]);
        return Promise.resolve(result);
      },
    };
    const gteStep = {
      gte: (col: string, val: unknown) => {
        calls.push(["gte", col, val]);
        return orderStep;
      },
    };
    const client = {
      from: (table: string) => {
        calls.push(["from", table]);
        return {
          select: (cols: string) => {
            calls.push(["select", cols]);
            return gteStep;
          },
        };
      },
    };
    return { calls, client };
  }

  it("queries bookings from today ordered by date", async () => {
    const rows = [
      { date: "2026-10-11", status: "confirmed" },
      { date: "2026-10-12", status: "pending" },
    ];
    const { calls, client } = fakeClient({ data: rows, error: null });
    await expect(
      getOverviewBookings(asClient(client), "2026-10-11"),
    ).resolves.toEqual(rows);
    expect(calls).toContainEqual(["from", "bookings"]);
    expect(calls).toContainEqual(["gte", "date", "2026-10-11"]);
    expect(calls).toContainEqual(["order", "date", { ascending: true }]);
  });

  it("throws instead of showing empty overview on error", async () => {
    const { client } = fakeClient({
      data: null,
      error: { message: "db down" },
    });
    await expect(
      getOverviewBookings(asClient(client), "2026-10-11"),
    ).rejects.toThrow(/db down/);
  });
});
