import type { DayStatus } from "./availability";
import type { RpcClient } from "./month-availability";

export interface DaySchedule {
  date: string; // "YYYY-MM-DD"
  status: DayStatus;
  allDayBlocked: boolean;
  occupied: unknown[];
  free: unknown[];
}

const DAY_STATUSES: readonly DayStatus[] = [
  "available",
  "fully_booked",
  "blocked",
];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Map a raw `get_day_schedule` RPC payload to the public day-detail
 * shape. Strips any extra keys so client PII (names, phones, notes,
 * block reasons) and operating hours can never leak to the browser,
 * and fails closed on unknown status / malformed date.
 *
 * v1 only needs date + status + all-day flag; occupied/free ride
 * along as empty arrays so the shape stays stable for tickets 02/03.
 */
export function mapDayScheduleRow(row: unknown): DaySchedule {
  if (typeof row !== "object" || row === null) {
    throw new Error("Invalid day schedule row");
  }
  const { date, status, all_day_blocked } = row as Record<string, unknown>;
  if (typeof date !== "string" || !DATE_RE.test(date)) {
    throw new Error(`Invalid date in day schedule: ${String(date)}`);
  }
  if (
    typeof status !== "string" ||
    !(DAY_STATUSES as readonly string[]).includes(status)
  ) {
    throw new Error(`Unknown day status in day schedule: ${String(status)}`);
  }
  if (typeof all_day_blocked !== "boolean") {
    throw new Error("Invalid day schedule row: all_day_blocked must be boolean");
  }
  const { occupied, free } = row as Record<string, unknown>;
  if (!Array.isArray(occupied) || !Array.isArray(free)) {
    throw new Error("Invalid day schedule row: occupied/free must be arrays");
  }
  return {
    date,
    status: status as DayStatus,
    allDayBlocked: all_day_blocked,
    occupied,
    free,
  };
}

/**
 * Public day-schedule fetch for the `get_day_schedule` RPC.
 * Calls the RPC (which returns times+kind only, no PII/hours) and
 * validates the row on the way out.
 */
export async function getDaySchedule(
  client: RpcClient,
  date: string, // "YYYY-MM-DD"
): Promise<DaySchedule> {
  if (!DATE_RE.test(date)) {
    throw new Error(`Invalid date, expected YYYY-MM-DD: ${date}`);
  }
  const { data, error } = await client.rpc("get_day_schedule", {
    p_date: date,
  });
  if (error) throw new Error(`Day schedule RPC failed: ${error.message}`);
  return mapDayScheduleRow(data);
}
