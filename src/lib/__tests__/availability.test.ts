import { describe, expect, it } from "vitest";
import { computeDayStatus, doesOverlap } from "../availability";

// Window-free derivation (hours-removal contract): coverage derivation is
// removed, so fully_booked is unreachable — full-toggle dates and all-day
// blocks resolve to blocked, everything else is available.
describe("computeDayStatus", () => {
  it("returns available when nothing occupies the day", () => {
    expect(computeDayStatus("2026-10-12", [], [], [])).toBe("available");
  });

  it("returns available when only partially occupied", () => {
    expect(
      computeDayStatus(
        "2026-10-12",
        [{ start_time: "09:00", end_time: "10:00" }],
        [],
        [],
      ),
    ).toBe("available");
  });

  it("returns available even when bookings span the whole day (no window to cover)", () => {
    expect(
      computeDayStatus(
        "2026-10-12",
        [
          { start_time: "09:00", end_time: "13:00" },
          { start_time: "13:00", end_time: "19:00" },
        ],
        [],
        [],
      ),
    ).toBe("available");
  });

  it("returns available when bookings + time-range blocks jointly span the day", () => {
    expect(
      computeDayStatus(
        "2026-10-12",
        [{ start_time: "09:00", end_time: "12:00" }],
        [{ all_day: false, start_time: "12:00", end_time: "19:00" }],
        [],
      ),
    ).toBe("available");
  });

  it("returns blocked for an all-day block", () => {
    expect(computeDayStatus("2026-10-12", [], [{ all_day: true }], [])).toBe(
      "blocked",
    );
  });

  it("returns blocked when the date is in fullDates (manual full toggle)", () => {
    expect(computeDayStatus("2026-10-12", [], [], ["2026-10-12"])).toBe(
      "blocked",
    );
  });

  it("prefers blocked over occupancy when both apply", () => {
    expect(
      computeDayStatus(
        "2026-10-12",
        [{ start_time: "09:00", end_time: "19:00" }],
        [{ all_day: true }],
        [],
      ),
    ).toBe("blocked");
  });

  it("returns blocked when full-toggle and occupancy coincide", () => {
    expect(
      computeDayStatus(
        "2026-10-12",
        [{ start_time: "00:00", end_time: "23:59" }],
        [],
        ["2026-10-12"],
      ),
    ).toBe("blocked");
  });
});

describe("doesOverlap", () => {
  it("returns true for overlapping ranges", () => {
    expect(doesOverlap("09:00", "11:00", "10:00", "12:00")).toBe(true);
  });

  it("returns true when one range contains the other", () => {
    expect(doesOverlap("09:00", "19:00", "10:00", "11:00")).toBe(true);
  });

  it("returns false for adjacent (touching) ranges", () => {
    expect(doesOverlap("09:00", "10:00", "10:00", "11:00")).toBe(false);
  });

  it("returns false for disjoint ranges", () => {
    expect(doesOverlap("09:00", "10:00", "11:00", "12:00")).toBe(false);
  });
});
