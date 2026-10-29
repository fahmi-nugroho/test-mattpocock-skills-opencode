import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  GoogleCalendarEventRow,
  GoogleCalendarOperation,
  GoogleCalendarWorkRow,
} from "./database";

type TypedClient = SupabaseClient<Database>;

/**
 * Browser-side mirror queue helpers (ticket 02).
 *
 * A Booking save writes the Booking exactly as before, then leaves one intent
 * in `google_calendar_work` and moves on. The RPC coalesces on Booking id, so
 * repeated saves refresh a single pending intent instead of stacking work.
 * Nothing here holds a Google credential; only the Node route drains.
 */
export async function enqueueMirrorWork(
  client: TypedClient,
  bookingId: string,
  operation: GoogleCalendarOperation,
): Promise<void> {
  const loose = client as unknown as {
    rpc(
      name: string,
      args: Record<string, unknown>,
    ): Promise<{ error: { message: string } | null }>;
  };
  const { error } = await loose.rpc("enqueue_google_calendar_work", {
    p_booking_id: bookingId,
    p_operation: operation,
  });
  if (error) {
    throw new Error(`Gagal menjadwalkan sinkronisasi Google: ${error.message}`);
  }
}

async function selectAll<T>(
  client: TypedClient,
  table: string,
): Promise<T[]> {
  const loose = client as unknown as {
    from(name: string): {
      select(columns: string): Promise<{
        data: unknown;
        error: { message: string } | null;
      }>;
    };
  };
  const { data, error } = await loose.from(table).select("*");
  if (error) throw new Error(`Gagal memuat status Google: ${error.message}`);
  return Array.isArray(data) ? (data as T[]) : [];
}

export interface MirrorSnapshot {
  tracked: GoogleCalendarEventRow[];
  work: GoogleCalendarWorkRow[];
}

/** The rows the Booking manager derives Tersinkron / Menunggu / Gagal from. */
export async function listMirrorSnapshot(
  client: TypedClient,
): Promise<MirrorSnapshot> {
  const [tracked, work] = await Promise.all([
    selectAll<GoogleCalendarEventRow>(client, "google_calendar_events"),
    selectAll<GoogleCalendarWorkRow>(client, "google_calendar_work"),
  ]);
  return { tracked, work };
}
