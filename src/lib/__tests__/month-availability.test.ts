import { describe, expect, it } from "vitest";
import {
  getMonthAvailability,
  mapMonthAvailabilityRows,
} from "../month-availability";

// Seam 1 (pure): RPC row -> { date, status } mapping. Catches PII leak and
// invalid status passthrough. Misses SQL correctness (covered by schema.test.ts).
describe("mapMonthAvailabilityRows", () => {
  it("maps valid rows to date+status only (no PII)", () => {
    const rows = [
      { date: "2026-10-01", status: "available" },
      { date: "2026-10-02", status: "fully_booked" },
      { date: "2026-10-03", status: "blocked" },
    ];
    expect(mapMonthAvailabilityRows(rows)).toEqual(rows);
  });

  it("strips extra keys so client PII can never leak", () => {
    const rows = [
      {
        date: "2026-10-01",
        status: "available",
        client_name: "Secret",
        client_phone: "08123",
        notes: "private",
      },
    ];
    expect(mapMonthAvailabilityRows(rows)).toEqual([
      { date: "2026-10-01", status: "available" },
    ]);
  });

  it("throws on unknown status (fail closed, never trust DB text)", () => {
    expect(() =>
      mapMonthAvailabilityRows([{ date: "2026-10-01", status: "half-booked" }]),
    ).toThrow(/unknown day status/i);
  });

  it("throws on malformed date", () => {
    expect(() =>
      mapMonthAvailabilityRows([{ date: "01-10-2026", status: "available" }]),
    ).toThrow(/invalid date/i);
  });

  it("throws on non-array input", () => {
    expect(() => mapMonthAvailabilityRows(null)).toThrow();
  });
});

// Seam 2 (adapter): RPC client wrapper with injected client. Catches wrong
// RPC name/args and swallowed errors. Misses live RLS behavior.
describe("getMonthAvailability", () => {
  const MONTH = "2026-10";

  it("calls month_availability RPC with year/month args and maps rows", async () => {
    const rpcRows = [{ date: "2026-10-01", status: "available" }];
    const calls: Array<{ name: string; args: unknown }> = [];
    const fakeClient = {
      rpc: async (name: string, args: unknown) => {
        calls.push({ name, args });
        return { data: rpcRows, error: null };
      },
    };
    const result = await getMonthAvailability(fakeClient, MONTH);
    expect(calls).toEqual([
      { name: "get_month_availability", args: { p_year: 2026, p_month: 10 } },
    ]);
    expect(result).toEqual(rpcRows);
  });

  it("propagates RPC errors instead of returning empty availability", async () => {
    const fakeClient = {
      rpc: async () => ({ data: null, error: { message: "boom" } }),
    };
    await expect(getMonthAvailability(fakeClient, MONTH)).rejects.toThrow(
      /boom/,
    );
  });

  it("rejects malformed month input before hitting the DB", async () => {
    let called = false;
    const fakeClient = {
      rpc: async () => {
        called = true;
        return { data: [], error: null };
      },
    };
    await expect(getMonthAvailability(fakeClient, "october")).rejects.toThrow(
      /YYYY-MM/,
    );
    expect(called).toBe(false);
  });
});
