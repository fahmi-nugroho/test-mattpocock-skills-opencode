import { describe, expect, it } from "vitest";
import { getDaySchedule, mapDayScheduleRow } from "../day-schedule";

// Seam (pure): day-schedule payload -> { date, status, allDayBlocked,
// occupied, free } with PII stripped. Catches PII leak and invalid-kind
// passthrough. Misses SQL correctness (reviewed against 0004 logic).
describe("mapDayScheduleRow", () => {
  it("maps a closed-all-day payload", () => {
    expect(
      mapDayScheduleRow({
        date: "2026-10-15",
        status: "blocked",
        all_day_blocked: true,
        occupied: [],
        free: [],
      }),
    ).toEqual({
      date: "2026-10-15",
      status: "blocked",
      allDayBlocked: true,
      occupied: [],
      free: [],
    });
  });

  it("maps an empty-available payload", () => {
    expect(
      mapDayScheduleRow({
        date: "2026-10-16",
        status: "available",
        all_day_blocked: false,
        occupied: [],
        free: [],
      }),
    ).toEqual({
      date: "2026-10-16",
      status: "available",
      allDayBlocked: false,
      occupied: [],
      free: [],
    });
  });

  it("strips extra keys so client PII can never leak", () => {
    expect(
      mapDayScheduleRow({
        date: "2026-10-15",
        status: "blocked",
        all_day_blocked: true,
        occupied: [],
        free: [],
        client_name: "Secret",
        client_phone: "08123",
        notes: "private",
        reason: "cuti",
        open_hour: "09:00",
        close_hour: "19:00",
      }),
    ).toEqual({
      date: "2026-10-15",
      status: "blocked",
      allDayBlocked: true,
      occupied: [],
      free: [],
    });
  });

  it("throws on unknown status (fail closed)", () => {
    expect(() =>
      mapDayScheduleRow({
        date: "2026-10-15",
        status: "half-booked",
        all_day_blocked: false,
        occupied: [],
        free: [],
      }),
    ).toThrow(/unknown day status/i);
  });

  it("throws on malformed date", () => {
    expect(() =>
      mapDayScheduleRow({
        date: "15-10-2026",
        status: "available",
        all_day_blocked: false,
        occupied: [],
        free: [],
      }),
    ).toThrow(/invalid date/i);
  });

  it("throws on non-object input", () => {
    expect(() => mapDayScheduleRow(null)).toThrow();
  });

  it("throws when occupied/free are not arrays (fail closed)", () => {
    expect(() =>
      mapDayScheduleRow({
        date: "2026-10-15",
        status: "available",
        all_day_blocked: false,
        occupied: "09:00-10:00",
        free: [],
      }),
    ).toThrow(/occupied\/free must be arrays/i);
  });
});

// Seam (adapter): RPC client wrapper with injected client. Catches wrong
// RPC name/args and swallowed errors. Misses live RLS behavior.
describe("getDaySchedule", () => {
  const DATE = "2026-10-15";

  it("calls day_schedule RPC with date arg and maps the row", async () => {
    const rpcRow = {
      date: "2026-10-15",
      status: "blocked",
      all_day_blocked: true,
      occupied: [],
      free: [],
    };
    const calls: Array<{ name: string; args: unknown }> = [];
    const fakeClient = {
      rpc: async (name: string, args: unknown) => {
        calls.push({ name, args });
        return { data: rpcRow, error: null };
      },
    };
    const result = await getDaySchedule(fakeClient, DATE);
    expect(calls).toEqual([
      { name: "get_day_schedule", args: { p_date: DATE } },
    ]);
    expect(result).toEqual({
      date: "2026-10-15",
      status: "blocked",
      allDayBlocked: true,
      occupied: [],
      free: [],
    });
  });

  it("propagates RPC errors instead of returning empty detail", async () => {
    const fakeClient = {
      rpc: async () => ({ data: null, error: { message: "boom" } }),
    };
    await expect(getDaySchedule(fakeClient, DATE)).rejects.toThrow(/boom/);
  });

  it("rejects malformed date input before hitting the DB", async () => {
    let called = false;
    const fakeClient = {
      rpc: async () => {
        called = true;
        return { data: null, error: null };
      },
    };
    await expect(getDaySchedule(fakeClient, "yesterday")).rejects.toThrow(
      /YYYY-MM-DD/,
    );
    expect(called).toBe(false);
  });
});
