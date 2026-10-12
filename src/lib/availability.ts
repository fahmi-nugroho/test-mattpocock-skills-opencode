/**
 * Window-free day status (hours-removal contract).
 *
 * "fully_booked" is a DEAD status: with no operating window to cover,
 * coverage derivation was removed, so nothing resolves to fully_booked.
 * Manual full-toggle dates and all-day blocks resolve to "blocked";
 * everything else is "available". The fully_booked union member, legend
 * entry, and status metadata remain so the status can be revived later
 * by restoring the window columns (see docs/adr/0001-hours-removal.md),
 * re-adding coverage derivation, and reintroducing window arguments.
 */
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
 * Derive a public day status, window-free:
 * - "blocked" if there is an all-day block or the date is in fullDates
 *   (manual full-toggle).
 * - else "available" (any occupancy is shown as ranges in the popup;
 *   without a window there is no coverage to derive "fully_booked"
 *   from, so that status is unreachable).
 */
export function computeDayStatus(
  date: string, // "YYYY-MM-DD"
  bookingsForDay: BookingForDay[],
  blocksForDay: BlockForDay[],
  fullDates: string[],
): DayStatus {
  if (fullDates.includes(date)) return "blocked";
  if (blocksForDay.some((b) => b.all_day)) return "blocked";

  return "available";
}
