import { describe, expect, it } from "vitest";
import { computeDayStatus, doesOverlap } from "../availability";

const OPEN = "09:00";
const CLOSE = "19:00";

describe("computeDayStatus", () => {
  it("returns available when nothing occupies the day", () => {
    expect(computeDayStatus("2026-10-12", [], [], [], OPEN, CLOSE)).toBe(
      "available",
    );
  });

  it("returns available when only partially occupied", () => {
    expect(
      computeDayStatus(
        "2026-10-12",
        [{ start_time: "09:00", end_time: "10:00" }],
        [],
        [],
        OPEN,
        CLOSE,
      ),
    ).toBe("available");
  });

  it("returns fully_booked when bookings cover [open, close)", () => {
    expect(
      computeDayStatus(
        "2026-10-12",
        [
          { start_time: "09:00", end_time: "13:00" },
          { start_time: "13:00", end_time: "19:00" },
        ],
        [],
        [],
        OPEN,
        CLOSE,
      ),
    ).toBe("fully_booked");
  });

  it("returns fully_booked when bookings + time-range blocks jointly cover the day", () => {
    expect(
      computeDayStatus(
        "2026-10-12",
        [{ start_time: "09:00", end_time: "12:00" }],
        [{ all_day: false, start_time: "12:00", end_time: "19:00" }],
        [],
        OPEN,
        CLOSE,
      ),
    ).toBe("fully_booked");
  });

  it("returns blocked for an all-day block", () => {
    expect(
      computeDayStatus("2026-10-12", [], [{ all_day: true }], [], OPEN, CLOSE),
    ).toBe("blocked");
  });

  it("returns blocked when the date is in full_dates (manual full toggle)", () => {
    expect(
      computeDayStatus("2026-10-12", [], [], ["2026-10-12"], OPEN, CLOSE),
    ).toBe("blocked");
  });

  it("prefers blocked over fully_booked when both apply", () => {
    expect(
      computeDayStatus(
        "2026-10-12",
        [{ start_time: "09:00", end_time: "19:00" }],
        [{ all_day: true }],
        [],
        OPEN,
        CLOSE,
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
