import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getFullDates, toggleFullDate } from "../supabase/admin-full-dates";
import type { Database } from "../supabase/database";

type TypedClient = SupabaseClient<Database>;
const asClient = (client: unknown): TypedClient =>
  client as unknown as TypedClient;

// Seam 2 (adapter): manual full-toggle dates on settings id=1.
// Catches wrong row/update shape. Misses live RLS behavior.
describe("getFullDates", () => {
  it("reads full_dates from settings id=1", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const client = {
      from: (table: string) => {
        calls.push(["from", table]);
        return {
          select: (cols: string) => {
            calls.push(["select", cols]);
            return {
              eq: (col: string, val: unknown) => {
                calls.push(["eq", col, val]);
                return {
                  single: async () => ({
                    data: { full_dates: ["2026-10-12"] },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      },
    };
    await expect(getFullDates(asClient(client))).resolves.toEqual([
      "2026-10-12",
    ]);
    expect(calls).toContainEqual(["from", "settings"]);
    expect(calls).toContainEqual(["eq", "id", 1]);
  });
});

describe("toggleFullDate", () => {
  function settingsClient(current: string[], calls: Array<[string, ...unknown[]]>) {
    return {
      from: (table: string) => {
        calls.push(["from", table]);
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { full_dates: current },
                error: null,
              }),
            }),
          }),
          update: (values: { full_dates: string[] }) => {
            calls.push(["update", values]);
            return {
              eq: (col: string, val: unknown) => {
                calls.push(["eq", col, val]);
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
    };
  }

  it("adds the date when it is not yet marked full", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const dates = await toggleFullDate(
      asClient(settingsClient([], calls)),
      "2026-10-12",
    );
    expect(dates).toEqual(["2026-10-12"]);
    expect(calls).toContainEqual([
      "update",
      { full_dates: ["2026-10-12"] },
    ]);
  });

  it("removes the date when it is already marked full", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const dates = await toggleFullDate(
      asClient(settingsClient(["2026-10-12", "2026-10-13"], calls)),
      "2026-10-12",
    );
    expect(dates).toEqual(["2026-10-13"]);
  });

  it("rejects a malformed date instead of writing junk to settings", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    await expect(
      toggleFullDate(asClient(settingsClient([], calls)), "tomorrow"),
    ).rejects.toThrow(/tanggal|date/i);
  });
});
