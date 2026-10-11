/** Monday-first weekday headers for the public calendar (ID locale). */
export const WEEKDAY_HEADERS_ID = [
  "Sen",
  "Sel",
  "Rab",
  "Kam",
  "Jum",
  "Sab",
  "Min",
] as const;

const MONTH_RE = /^(\d{4})-(\d{2})$/;

/** Parse a "YYYY-MM" key into year + 1-based month, throwing on misuse. */
export function parseMonthKey(month: string): { year: number; month: number } {
  const match = MONTH_RE.exec(month);
  if (!match) throw new Error(`Invalid month, expected YYYY-MM: ${month}`);
  const year = Number(match[1]);
  const monthNum = Number(match[2]);
  if (monthNum < 1 || monthNum > 12) {
    throw new Error(`Invalid month, expected YYYY-MM: ${month}`);
  }
  return { year, month: monthNum };
}

/** Format year + 1-based month + day as a "YYYY-MM-DD" key. */
export function toDateKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Format year + 1-based month as a "YYYY-MM" key. */
export function toMonthKey(year: number, month: number): string {
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error(`Invalid month, expected YYYY-MM: ${year}-${month}`);
  }
  const key = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
  parseMonthKey(key); // range-check month 01..12
  return key;
}

/** Shift a "YYYY-MM" key by delta months (handles year rollover). */
export function shiftMonth(monthKey: string, delta: number): string {
  const { year, month } = parseMonthKey(monthKey);
  const total = (month - 1 + delta) % 12;
  const norm = total < 0 ? total + 12 : total;
  const yearDelta = Math.floor((month - 1 + delta - norm) / 12);
  return toMonthKey(year + yearDelta, norm + 1);
}

/** Render a "YYYY-MM" key as an Indonesian month label, e.g. "Oktober 2026". */
export function formatMonthId(monthKey: string): string {
  const { year, month } = parseMonthKey(monthKey);
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

/**
 * Monday-first grid cells for a month: leading nulls so day 1 lands
 * under the right weekday, then one "YYYY-MM-DD" string per date.
 */
export function getMonthCells(year: number, month: number): Array<string | null> {
  parseMonthKey(toMonthKey(year, month));
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
  const leadingBlanks = (firstWeekday + 6) % 7; // Monday-first offset
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: Array<string | null> = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toDateKey(year, month, day));
  }
  return cells;
}

/** Today's local date as "YYYY-MM-DD" (client-side past greying). */
export function getTodayKey(from: Date = new Date()): string {
  const y = from.getFullYear();
  const m = String(from.getMonth() + 1).padStart(2, "0");
  const d = String(from.getDate()).padStart(2, "0");
  return `${String(y).padStart(4, "0")}-${m}-${d}`;
}

/**
 * True when dateStr is strictly before todayStr. Both "YYYY-MM-DD",
 * so lexicographic comparison matches chronological order.
 */
export function isPastDate(dateStr: string, todayStr: string): boolean {
  return dateStr < todayStr;
}
