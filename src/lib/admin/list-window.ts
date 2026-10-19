/**
 * Pure list-windowing helpers for the admin Booking and Permintaan dialogs
 * (form-layout-polish ticket 03). Nothing here touches Supabase, React, or
 * the clock: the caller passes its rows and today's key.
 */

/** Rows one page of either dialog shows before "Muat lebih banyak". */
export const LIST_PAGE_SIZE = 10;

/** The two fields the Booking dialog's date split orders by. */
export interface DatedRow {
  date: string; // "YYYY-MM-DD"
  start_time: string; // "HH:MM"
}

/** A Booking list split into what is still to come and what is past. */
export interface DatedSplit<T> {
  upcoming: T[];
  history: T[];
}

/**
 * Split Bookings at today: a row dated today counts as *Mendatang*, not
 * history. Upcoming reads forward (date, then start); history reads newest
 * first (date descending, then start descending). Grouping is by date alone,
 * so a cancelled past row is still history. Input order is never mutated.
 */
export function splitByToday<T extends DatedRow>(
  rows: readonly T[],
  todayKey: string,
): DatedSplit<T> {
  const upcoming: T[] = [];
  const history: T[] = [];
  for (const row of rows) {
    if (row.date >= todayKey) upcoming.push(row);
    else history.push(row);
  }
  upcoming.sort(byDateThenStart);
  // Newest first: the same rule read backwards, so the two orders can't drift.
  history.sort((a, b) => byDateThenStart(b, a));
  return { upcoming, history };
}

/** The visible slice of a list plus how many rows the reveal still hides. */
export interface ListWindow<T> {
  visible: T[];
  hidden: number;
}

/**
 * Cap-and-reveal window: show the first `revealed` rows and report the
 * remainder. Callers reset `revealed` to `LIST_PAGE_SIZE` whenever the chip
 * or the search text changes, so a narrowed list always opens at one page.
 */
export function windowRows<T>(
  rows: readonly T[],
  revealed: number,
): ListWindow<T> {
  const visible = rows.slice(0, revealed);
  return { visible, hidden: rows.length - visible.length };
}

function byDateThenStart(a: DatedRow, b: DatedRow): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.start_time.localeCompare(b.start_time);
}
