import { describe, expect, it } from "vitest";
import {
  WEEKDAY_HEADERS_ID,
  formatMonthId,
  getMonthCells,
  getTodayKey,
  isPastDate,
  shiftMonth,
  toMonthKey,
} from "../calendar";

// Seam (pure): month-grid + ID labels + past check for the public
// calendar. Catches date math and locale errors. Misses rendering and
// live RPC behavior (covered by month-availability.test.ts).
describe("toMonthKey / shiftMonth", () => {
  it("formats year + 1-based month as YYYY-MM", () => {
    expect(toMonthKey(2026, 10)).toBe("2026-10");
    expect(toMonthKey(2026, 1)).toBe("2026-01");
  });

  it("shifts months across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-10", 1)).toBe("2026-11");
  });

  it("rejects malformed month keys", () => {
    expect(() => shiftMonth("october", 1)).toThrow(/YYYY-MM/);
    expect(() => shiftMonth("2026-13", 1)).toThrow(/YYYY-MM/);
  });
});

describe("formatMonthId", () => {
  it("renders the month label in Indonesian", () => {
    expect(formatMonthId("2026-10")).toBe("Oktober 2026");
    expect(formatMonthId("2026-01")).toBe("Januari 2026");
  });

  it("rejects malformed month input", () => {
    expect(() => formatMonthId("october")).toThrow(/YYYY-MM/);
  });
});

describe("getMonthCells", () => {
  it("uses Monday-first Indonesian weekday headers", () => {
    expect(WEEKDAY_HEADERS_ID).toEqual([
      "Sen",
      "Sel",
      "Rab",
      "Kam",
      "Jum",
      "Sab",
      "Min",
    ]);
  });

  it("pads leading blanks so day 1 lands under the right weekday", () => {
    // 2026-10-01 is a Thursday -> 3 Monday-first blanks (Sen/Sel/Rab).
    const cells = getMonthCells(2026, 10);
    expect(cells.slice(0, 3)).toEqual([null, null, null]);
    expect(cells[3]).toBe("2026-10-01");
  });

  it("covers every date of the month exactly once", () => {
    const cells = getMonthCells(2026, 2);
    const dates = cells.filter((c): c is string => c !== null);
    expect(dates).toHaveLength(28);
    expect(dates[0]).toBe("2026-02-01");
    expect(dates[27]).toBe("2026-02-28");
  });
});

describe("isPastDate / getTodayKey", () => {
  it("compares calendar dates (strictly before today)", () => {
    expect(isPastDate("2026-10-10", "2026-10-11")).toBe(true);
    expect(isPastDate("2026-10-11", "2026-10-11")).toBe(false);
    expect(isPastDate("2026-10-12", "2026-10-11")).toBe(false);
  });

  it("returns today's local date as YYYY-MM-DD", () => {
    expect(getTodayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
