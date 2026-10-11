import type { DayStatus } from "./availability";
import type { RpcClient } from "./month-availability";

export interface DayOccupied {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  kind: "booked" | "blocked";
}

export interface DaySchedule {
  date: string; // "YYYY-MM-DD"
  status: DayStatus;
  allDayBlocked: boolean;
  occupied: DayOccupied[];
  free: unknown[];
}

const DAY_STATUSES: readonly DayStatus[] = [
  "available",
  "fully_booked",
  "blocked",
];
const OCCUPIED_KINDS: readonly DayOccupied["kind"][] = ["booked", "blocked"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** Map one occupied item, stripping extra keys (fail closed on bad shape). */
function mapOccupiedItem(item: unknown): DayOccupied {
  if (typeof item !== "object" || item === null) {
    throw new Error("Invalid occupied item in day schedule");
  }
  const { start, end, kind } = item as Record<string, unknown>;
  if (
    typeof start !== "string" ||
    typeof end !== "string" ||
    !HHMM_RE.test(start) ||
    !HHMM_RE.test(end) ||
    !(start < end)
  ) {
    throw new Error(
      `Invalid occupied time in day schedule: ${String(start)}-${String(end)}`,
    );
  }
  if (
    typeof kind !== "string" ||
    !(OCCUPIED_KINDS as readonly string[]).includes(kind)
  ) {
    throw new Error(`Unknown occupied kind in day schedule: ${String(kind)}`);
  }
  return { start, end, kind: kind as DayOccupied["kind"] };
}

/**
 * Sort occupied intervals chronologically and merge adjacent or
 * overlapping same-kind intervals for display. Different-kind intervals
 * stay separate (admin guards already prevent overlap; the merge is
 * defensive). Half-open semantics match `doesOverlap`: touching ranges
 * (end === start) merge only within the same kind.
 */
export function mergeOccupied(items: DayOccupied[]): DayOccupied[] {
  const sorted = [...items].sort((a, b) =>
    a.start < b.start
      ? -1
      : a.start > b.start
        ? 1
        : a.kind < b.kind
          ? -1
          : a.kind > b.kind
            ? 1
            : 0,
  );
  const merged: DayOccupied[] = [];
  for (const item of sorted) {
    const last = merged[merged.length - 1];
    if (last && last.kind === item.kind && item.start <= last.end) {
      if (item.end > last.end) last.end = item.end;
    } else {
      merged.push({ ...item });
    }
  }
  return merged;
}

/**
 * Map a raw `get_day_schedule` RPC payload to the public day-detail
 * shape. Strips any extra keys so client PII (names, phones, notes,
 * block reasons) and operating hours can never leak to the browser,
 * and fails closed on unknown status / malformed date, times, or kinds.
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
    occupied: occupied.map(mapOccupiedItem),
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
