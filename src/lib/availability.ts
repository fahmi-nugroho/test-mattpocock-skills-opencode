export type DayStatus = "available" | "fully_booked" | "blocked";

export interface BookingForDay {
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
}

export interface BlockForDay {
  all_day: boolean;
  start_time?: string; // "HH:MM", required when all_day is false
  end_time?: string; // "HH:MM", required when all_day is false
}

/**
 * Half-open overlap check on "HH:MM" strings (zero-padded, so plain
 * string comparison matches chronological order). Adjacent ranges
 * (aEnd === bStart) do NOT overlap.
 */
export function doesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Derive a public day status per spec calendar rule:
 * - "blocked" if there is an all-day block or the date is in fullDates
 *   (manual full-toggle).
 * - else "fully_booked" if bookings + time-range blocks jointly cover
 *   the whole [open, close) operating window.
 * - else "available" (partial occupancy is still available; the UI may
 *   render a dot for it).
 */
export function computeDayStatus(
  date: string, // "YYYY-MM-DD"
  bookingsForDay: BookingForDay[],
  blocksForDay: BlockForDay[],
  fullDates: string[],
  open: string, // "HH:MM"
  close: string, // "HH:MM"
): DayStatus {
  if (fullDates.includes(date)) return "blocked";
  if (blocksForDay.some((b) => b.all_day)) return "blocked";

  const intervals: Array<[string, string]> = [];
  for (const b of bookingsForDay) intervals.push([b.start_time, b.end_time]);
  for (const b of blocksForDay) {
    if (!b.all_day && b.start_time && b.end_time) {
      intervals.push([b.start_time, b.end_time]);
    }
  }

  if (coversWindow(intervals, open, close)) return "fully_booked";
  return "available";
}

/** True if the union of half-open intervals covers [open, close). */
function coversWindow(
  intervals: Array<[string, string]>,
  open: string,
  close: string,
): boolean {
  const clamped = intervals
    .map(([s, e]): [string, string] | null => {
      const start = s < open ? open : s;
      const end = e > close ? close : e;
      return start < end ? [start, end] : null;
    })
    .filter((x): x is [string, string] => x !== null)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  let cursor = open;
  for (const [s, e] of clamped) {
    if (s > cursor) return false; // gap
    if (e > cursor) cursor = e;
    if (cursor >= close) return true;
  }
  return cursor >= close;
}
