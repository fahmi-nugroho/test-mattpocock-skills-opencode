import type { DayStatus } from "./availability";

export interface MonthDayStatus {
  date: string; // "YYYY-MM-DD"
  status: DayStatus;
}

const DAY_STATUSES: readonly DayStatus[] = [
  "available",
  "fully_booked",
  "blocked",
];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

/** Minimal shape of a Supabase client sufficient for the RPC call. */
export interface RpcClient {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
}

/**
 * Map raw RPC rows to date+status only. Strips any extra keys so client
 * PII can never leak to the public calendar, and fails closed on unknown
 * status / malformed date.
 */
export function mapMonthAvailabilityRows(rows: unknown): MonthDayStatus[] {
  if (!Array.isArray(rows)) throw new Error("Invalid month availability rows");
  return rows.map((row) => {
    if (typeof row !== "object" || row === null) {
      throw new Error("Invalid month availability row");
    }
    const { date, status } = row as Record<string, unknown>;
    if (typeof date !== "string" || !DATE_RE.test(date)) {
      throw new Error(`Invalid date in month availability: ${String(date)}`);
    }
    if (
      typeof status !== "string" ||
      !(DAY_STATUSES as readonly string[]).includes(status)
    ) {
      throw new Error(`Unknown day status in month availability: ${String(status)}`);
    }
    return { date, status: status as DayStatus };
  });
}

/**
 * Public month-availability fetch (ticket 02: typed access for the
 * get_month_availability RPC from 0004_seed_rpc.sql). Calls the
 * `get_month_availability` RPC (which returns date+status only, no
 * bookings/PII) and validates the rows on the way out.
 */
export async function getMonthAvailability(
  client: RpcClient,
  month: string, // "YYYY-MM"
): Promise<MonthDayStatus[]> {
  const match = MONTH_RE.exec(month);
  if (!match) throw new Error(`Invalid month, expected YYYY-MM: ${month}`);
  const p_year = Number(match[1]);
  const p_month = Number(match[2]);
  if (p_month < 1 || p_month > 12) {
    throw new Error(`Invalid month, expected YYYY-MM: ${month}`);
  }
  const { data, error } = await client.rpc("get_month_availability", {
    p_year,
    p_month,
  });
  if (error) throw new Error(`Month availability RPC failed: ${error.message}`);
  return mapMonthAvailabilityRows(data);
}
