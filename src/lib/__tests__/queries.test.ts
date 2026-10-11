import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveServices, getVisiblePortfolioItems } from "../supabase/queries";
import type { Database } from "../supabase/database";

type TypedClient = SupabaseClient<Database>;

/** Cast the recording fake to the typed client (adapter seam). */
const asClient = (client: unknown): TypedClient =>
  client as unknown as TypedClient;

// Seam 4 (adapter): public read helpers with injected client. Catches wrong
// table/filter/order and swallowed errors. Misses live RLS behavior.
function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  builder.eq = (col: string, val: unknown) => {
    calls.push(["eq", col, val]);
    return builder;
  };
  builder.order = (col: string, opts: unknown) => {
    calls.push(["order", col, opts]);
    return builder;
  };
  // supabase builders are thenables — awaiting resolves the query result.
  builder.then = (
    resolve: (v: unknown) => void,
    reject: (e: unknown) => void,
  ) => Promise.resolve(result).then(resolve, reject);
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
  return { calls, client };
}

describe("getActiveServices", () => {
  it("queries services filtered to active, ordered by sort", async () => {
    const rows = [{ id: "1", name: "Makeup", active: true, sort: 0 }];
    const { calls, client } = fakeClient({ data: rows, error: null });
    await expect(getActiveServices(asClient(client))).resolves.toEqual(rows);
    expect(calls).toContainEqual(["from", "services"]);
    expect(calls).toContainEqual(["eq", "active", true]);
    expect(calls).toContainEqual(["order", "sort", { ascending: true }]);
  });

  it("throws instead of returning empty prices on error", async () => {
    const { client } = fakeClient({ data: null, error: { message: "db down" } });
    await expect(getActiveServices(asClient(client))).rejects.toThrow(/db down/);
  });
});

describe("getVisiblePortfolioItems", () => {
  it("queries portfolio_items filtered to visible, ordered by sort", async () => {
    const rows = [{ id: "1", title: "Look", visible: true, sort: 0 }];
    const { calls, client } = fakeClient({ data: rows, error: null });
    await expect(getVisiblePortfolioItems(asClient(client))).resolves.toEqual(rows);
    expect(calls).toContainEqual(["from", "portfolio_items"]);
    expect(calls).toContainEqual(["eq", "visible", true]);
    expect(calls).toContainEqual(["order", "sort", { ascending: true }]);
  });

  it("throws instead of returning an empty grid on error", async () => {
    const { client } = fakeClient({ data: null, error: { message: "db down" } });
    await expect(getVisiblePortfolioItems(asClient(client))).rejects.toThrow(/db down/);
  });
});
