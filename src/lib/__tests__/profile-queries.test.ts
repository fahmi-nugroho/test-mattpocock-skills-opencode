import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getVisibleProfileStats,
  getVisibleTestimonials,
} from "../supabase/queries";
import type { Database } from "../supabase/database";

type TypedClient = SupabaseClient<Database>;

/** Cast the recording fake to the typed client (adapter seam). */
const asClient = (client: unknown): TypedClient =>
  client as unknown as TypedClient;

// Seam (adapter, PUBLIC READ): visible-only ordered reads for the new
// testimonials + profile_stats tables via the shared queryOrderedPublicList
// seam. Catches wrong table/filter/order and swallowed errors. Misses live
// RLS behavior. Empty-array passthrough keeps the landing fallback path
// (HERO_STATS / TESTIMONIALS) working when the tables are empty.
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

describe("getVisibleTestimonials", () => {
  it("queries testimonials filtered to visible, ordered by sort", async () => {
    const rows = [{ id: "1", quote: "Bagus", client_name: "A", visible: true, sort: 0 }];
    const { calls, client } = fakeClient({ data: rows, error: null });
    await expect(getVisibleTestimonials(asClient(client))).resolves.toEqual(rows);
    expect(calls).toContainEqual(["from", "testimonials"]);
    expect(calls).toContainEqual(["eq", "visible", true]);
    expect(calls).toContainEqual(["order", "sort", { ascending: true }]);
  });

  it("passes empty arrays through so the landing fallback renders", async () => {
    const { client } = fakeClient({ data: [], error: null });
    await expect(getVisibleTestimonials(asClient(client))).resolves.toEqual([]);
  });

  it("throws instead of returning an empty list on error", async () => {
    const { client } = fakeClient({ data: null, error: { message: "db down" } });
    await expect(getVisibleTestimonials(asClient(client))).rejects.toThrow(
      /Failed to load testimonials.*db down/,
    );
  });
});

describe("getVisibleProfileStats", () => {
  it("queries profile_stats filtered to visible, ordered by sort", async () => {
    const rows = [{ id: "1", value: "5+", label: "Tahun", visible: true, sort: 0 }];
    const { calls, client } = fakeClient({ data: rows, error: null });
    await expect(getVisibleProfileStats(asClient(client))).resolves.toEqual(rows);
    expect(calls).toContainEqual(["from", "profile_stats"]);
    expect(calls).toContainEqual(["eq", "visible", true]);
    expect(calls).toContainEqual(["order", "sort", { ascending: true }]);
  });

  it("passes empty arrays through so the landing fallback renders", async () => {
    const { client } = fakeClient({ data: [], error: null });
    await expect(getVisibleProfileStats(asClient(client))).resolves.toEqual([]);
  });

  it("throws instead of returning an empty list on error", async () => {
    const { client } = fakeClient({ data: null, error: { message: "db down" } });
    await expect(getVisibleProfileStats(asClient(client))).rejects.toThrow(
      /Failed to load profile stats.*db down/,
    );
  });
});
