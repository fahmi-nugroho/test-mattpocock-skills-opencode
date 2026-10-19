import { describe, expect, it } from "vitest";
import {
  LIST_PAGE_SIZE,
  splitByToday,
  windowRows,
} from "../admin/list-window";

// Seam (pure): the Booking dialog's Mendatang/Riwayat split and the
// cap-and-reveal window both dialogs share. Catches the today boundary,
// the per-group ordering, and off-by-one errors in the reveal arithmetic.
// Misses the component wiring (which rows the managers pass in).
describe("splitByToday", () => {
  const today = "2026-10-19";
  const row = (
    id: string,
    date: string,
    start_time: string,
    status = "confirmed",
  ) => ({ id, date, start_time, status });

  it("puts a booking dated today in Mendatang", () => {
    const { upcoming, history } = splitByToday(
      [row("today", today, "09:00")],
      today,
    );
    expect(upcoming.map((r) => r.id)).toEqual(["today"]);
    expect(history).toEqual([]);
  });

  it("files a cancelled past booking under Riwayat", () => {
    const { upcoming, history } = splitByToday(
      [row("past", "2026-10-18", "09:00", "cancelled")],
      today,
    );
    expect(upcoming).toEqual([]);
    expect(history.map((r) => r.id)).toEqual(["past"]);
  });

  it("orders Mendatang by date then start", () => {
    const { upcoming } = splitByToday(
      [
        row("later", "2026-10-21", "08:00"),
        row("same-day-late", "2026-10-20", "15:00"),
        row("same-day-early", "2026-10-20", "09:00"),
        row("today", today, "12:00"),
      ],
      today,
    );
    expect(upcoming.map((r) => r.id)).toEqual([
      "today",
      "same-day-early",
      "same-day-late",
      "later",
    ]);
  });

  it("orders Riwayat newest first, latest start first on one day", () => {
    const { history } = splitByToday(
      [
        row("older", "2026-09-01", "10:00"),
        row("recent-early", "2026-10-18", "09:00"),
        row("recent-late", "2026-10-18", "16:00"),
      ],
      today,
    );
    expect(history.map((r) => r.id)).toEqual([
      "recent-late",
      "recent-early",
      "older",
    ]);
  });

  it("returns two empty groups for no rows", () => {
    expect(splitByToday([], today)).toEqual({ upcoming: [], history: [] });
  });

  it("does not mutate the rows it is given", () => {
    const rows = [
      row("later", "2026-10-21", "08:00"),
      row("today", today, "12:00"),
    ];
    splitByToday(rows, today);
    expect(rows.map((r) => r.id)).toEqual(["later", "today"]);
  });
});

describe("windowRows", () => {
  const rows = Array.from({ length: 25 }, (_, i) => i);

  it("shares one page size of ten", () => {
    expect(LIST_PAGE_SIZE).toBe(10);
  });

  it("reveals nothing when nothing has been revealed", () => {
    expect(windowRows(rows, 0)).toEqual({ visible: [], hidden: 25 });
  });

  it("shows a partial page and hides nothing when the list is short", () => {
    expect(windowRows([1, 2, 3, 4], LIST_PAGE_SIZE)).toEqual({
      visible: [1, 2, 3, 4],
      hidden: 0,
    });
  });

  it("hides nothing when the list fits exactly one page", () => {
    expect(windowRows(rows.slice(0, 10), LIST_PAGE_SIZE)).toEqual({
      visible: rows.slice(0, 10),
      hidden: 0,
    });
  });

  it("shows one page and counts the hidden remainder", () => {
    expect(windowRows(rows, LIST_PAGE_SIZE)).toEqual({
      visible: rows.slice(0, 10),
      hidden: 15,
    });
  });

  it("reveals another page at a time until the list is exhausted", () => {
    expect(windowRows(rows, LIST_PAGE_SIZE * 2)).toEqual({
      visible: rows.slice(0, 20),
      hidden: 5,
    });
    expect(windowRows(rows, LIST_PAGE_SIZE * 3)).toEqual({
      visible: rows,
      hidden: 0,
    });
  });

  it("never shows more rows than exist", () => {
    expect(windowRows(rows.slice(0, 3), LIST_PAGE_SIZE * 5)).toEqual({
      visible: rows.slice(0, 3),
      hidden: 0,
    });
  });
});
