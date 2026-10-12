import { describe, expect, it } from "vitest";
import {
  getDaySchedule,
  mapDayScheduleRow,
  mergeOccupied,
} from "../day-schedule";

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

  it("maps occupied items to start/end/kind only (no PII)", () => {
    expect(
      mapDayScheduleRow({
        date: "2026-10-16",
        status: "available",
        all_day_blocked: false,
        occupied: [
          {
            start: "09:00",
            end: "10:00",
            kind: "booked",
            client_name: "Secret",
            client_phone: "08123",
            notes: "private",
          },
          { start: "13:00", end: "14:00", kind: "blocked", reason: "cuti" },
        ],
        free: [],
      }),
    ).toEqual({
      date: "2026-10-16",
      status: "available",
      allDayBlocked: false,
      occupied: [
        { start: "09:00", end: "10:00", kind: "booked" },
        { start: "13:00", end: "14:00", kind: "blocked" },
      ],
      free: [],
    });
  });

  it("throws on unknown occupied kind (fail closed)", () => {
    expect(() =>
      mapDayScheduleRow({
        date: "2026-10-16",
        status: "available",
        all_day_blocked: false,
        occupied: [{ start: "09:00", end: "10:00", kind: "tentative" }],
        free: [],
      }),
    ).toThrow(/unknown occupied kind/i);
  });

  it("throws on malformed occupied time (fail closed)", () => {
    expect(() =>
      mapDayScheduleRow({
        date: "2026-10-16",
        status: "available",
        all_day_blocked: false,
        occupied: [{ start: "9am", end: "10:00", kind: "booked" }],
        free: [],
      }),
    ).toThrow(/invalid occupied time/i);
  });

  it("throws when occupied start is not before end", () => {
    expect(() =>
      mapDayScheduleRow({
        date: "2026-10-16",
        status: "available",
        all_day_blocked: false,
        occupied: [{ start: "10:00", end: "10:00", kind: "booked" }],
        free: [],
      }),
    ).toThrow(/invalid occupied time/i);
  });

  it("maps a raw multi-range day at any hour in full, unclamped", () => {
    // Server returns occupied sorted chronologically (order by s, kind)
    // with raw unclamped times; the mapper must pass every range through.
    const occupied = [
      { start: "00:15", end: "01:00", kind: "booked" },
      { start: "06:30", end: "07:30", kind: "booked" },
      { start: "21:00", end: "23:00", kind: "blocked" },
    ];
    expect(
      mapDayScheduleRow({
        date: "2026-10-17",
        status: "available",
        all_day_blocked: false,
        occupied,
        free: [],
      }),
    ).toEqual({
      date: "2026-10-17",
      status: "available",
      allDayBlocked: false,
      occupied,
      free: [],
    });
  });

  it("strips service names and hours from occupied/free items", () => {
    expect(
      mapDayScheduleRow({
        date: "2026-10-17",
        status: "available",
        all_day_blocked: false,
        occupied: [
          {
            start: "06:30",
            end: "07:30",
            kind: "booked",
            service: "Akad",
            service_id: "uuid-1",
            open_hour: "09:00",
            close_hour: "19:00",
          },
        ],
        free: [{ start: "07:30", end: "08:00", open_hour: "09:00" }],
      }),
    ).toEqual({
      date: "2026-10-17",
      status: "available",
      allDayBlocked: false,
      occupied: [{ start: "06:30", end: "07:30", kind: "booked" }],
      free: [{ start: "07:30", end: "08:00" }],
    });
  });

  it("maps free gaps to start/end only (no hours leak)", () => {
    expect(
      mapDayScheduleRow({
        date: "2026-10-16",
        status: "available",
        all_day_blocked: false,
        occupied: [{ start: "09:00", end: "10:00", kind: "booked" }],
        free: [
          { start: "10:00", end: "19:00", open_hour: "09:00" },
        ],
      }),
    ).toEqual({
      date: "2026-10-16",
      status: "available",
      allDayBlocked: false,
      occupied: [{ start: "09:00", end: "10:00", kind: "booked" }],
      free: [{ start: "10:00", end: "19:00" }],
    });
  });

  it("throws on malformed free gap time (fail closed)", () => {
    expect(() =>
      mapDayScheduleRow({
        date: "2026-10-16",
        status: "available",
        all_day_blocked: false,
        occupied: [],
        free: [{ start: "10:00", end: "morning" }],
      }),
    ).toThrow(/invalid free gap/i);
  });

  it("throws when free gap start is not before end", () => {
    expect(() =>
      mapDayScheduleRow({
        date: "2026-10-16",
        status: "available",
        all_day_blocked: false,
        occupied: [],
        free: [{ start: "12:00", end: "12:00" }],
      }),
    ).toThrow(/invalid free gap/i);
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

// Seam (pure): occupied sort + adjacent same-kind merge for display.
// Catches out-of-order or fragmented ranges. Misses SQL ordering.
describe("mergeOccupied", () => {
  it("returns empty for empty input", () => {
    expect(mergeOccupied([])).toEqual([]);
  });

  it("merges adjacent same-kind intervals", () => {
    expect(
      mergeOccupied([
        { start: "09:00", end: "10:00", kind: "booked" },
        { start: "10:00", end: "11:00", kind: "booked" },
      ]),
    ).toEqual([{ start: "09:00", end: "11:00", kind: "booked" }]);
  });

  it("merges overlapping same-kind intervals", () => {
    expect(
      mergeOccupied([
        { start: "09:00", end: "10:30", kind: "blocked" },
        { start: "10:00", end: "11:00", kind: "blocked" },
      ]),
    ).toEqual([{ start: "09:00", end: "11:00", kind: "blocked" }]);
  });

  it("keeps different-kind intervals separate in chronological order", () => {
    expect(
      mergeOccupied([
        { start: "10:00", end: "11:00", kind: "blocked" },
        { start: "09:00", end: "10:00", kind: "booked" },
      ]),
    ).toEqual([
      { start: "09:00", end: "10:00", kind: "booked" },
      { start: "10:00", end: "11:00", kind: "blocked" },
    ]);
  });

  it("orders same-start intervals deterministically by kind", () => {
    expect(
      mergeOccupied([
        { start: "09:00", end: "10:00", kind: "booked" },
        { start: "09:00", end: "09:30", kind: "blocked" },
      ]),
    ).toEqual([
      { start: "09:00", end: "09:30", kind: "blocked" },
      { start: "09:00", end: "10:00", kind: "booked" },
    ]);
  });

  it("sorts unsorted input before merging", () => {    expect(
      mergeOccupied([
        { start: "11:00", end: "12:00", kind: "booked" },
        { start: "09:00", end: "10:00", kind: "booked" },
        { start: "10:00", end: "11:00", kind: "booked" },
      ]),
    ).toEqual([{ start: "09:00", end: "12:00", kind: "booked" }]);
  });
});
