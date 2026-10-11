import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database";

type TypedClient = SupabaseClient<Database>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function readFullDates(client: TypedClient): Promise<string[]> {
  const loose = client as unknown as {
    from(t: string): {
      select(c: string): {
        eq(c: string, v: number): {
          single(): Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    };
  };
  const { data, error } = await loose
    .from("settings")
    .select("full_dates")
    .eq("id", 1)
    .single();
  if (error) throw new Error(`Failed to load full dates: ${error.message}`);
  const dates = (data as { full_dates?: unknown } | null)?.full_dates;
  return Array.isArray(dates) ? (dates as string[]) : [];
}

async function writeFullDates(
  client: TypedClient,
  fullDates: string[],
): Promise<void> {
  const loose = client as unknown as {
    from(t: string): {
      update(v: { full_dates: string[] }): {
        eq(c: string, v: number): Promise<{ error: { message: string } | null }>;
      };
    };
  };
  const { error } = await loose
    .from("settings")
    .update({ full_dates: fullDates })
    .eq("id", 1);
  if (error) throw new Error(`Failed to save full dates: ${error.message}`);
}

/**
 * Manual full-toggle read (ticket 07): full_dates on settings id=1.
 * Dates here map to "blocked" in the public month RPC (0004), same as
 * an all-day block. Call with an authenticated browser client.
 */
export async function getFullDates(client: TypedClient): Promise<string[]> {
  return readFullDates(client);
}

/**
 * Manual full-toggle per date (ticket 07): adds the date when absent,
 * removes it when present, and persists the sorted array on settings
 * id=1. Returns the new array so the admin calendar can re-render
 * without a refetch.
 *
 * Deliberate override semantics: toggling full over existing confirmed
 * bookings is ALLOWED (the date is meant to read "blocked" in public
 * either way — full_dates maps to blocked in the month RPC just like an
 * all-day block). The guard runs in the other direction instead:
 * confirming/saving a booking on a full-toggle date is rejected in
 * booking-conflicts.ts, so no new double-booking can be created under
 * the toggle.
 */
export async function toggleFullDate(
  client: TypedClient,
  date: string,
): Promise<string[]> {
  if (!DATE_RE.test(date)) {
    throw new Error("Tanggal harus format YYYY-MM-DD");
  }
  const current = await readFullDates(client);
  const next = current.includes(date)
    ? current.filter((d) => d !== date)
    : [...current, date].sort();
  await writeFullDates(client, next);
  return next;
}
