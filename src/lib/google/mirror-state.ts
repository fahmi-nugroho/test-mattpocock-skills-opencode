import type {
  Booking,
  BookingStatus,
  GoogleCalendarEventRow,
  GoogleCalendarWorkRow,
} from "../supabase/database";

/**
 * Per-Booking mirror state, derived — never hand-set (ticket 02).
 *
 * The dashboard shows whether Google has a Booking by looking at the tracked
 * event row and the open work row. A processed queue row is history and is
 * ignored; a failed last attempt wins over a tracked event, because the owner
 * needs to see that the latest change did not reach Google. Nothing is
 * inferred from the Booking status alone: no tracked event and no open intent
 * means there is nothing to report, so the row shows no badge.
 */
export type MirrorState = "synced" | "pending" | "failed";

export const MIRROR_STATE_LABEL: Record<MirrorState, string> = {
  synced: "Tersinkron",
  pending: "Menunggu",
  failed: "Gagal",
};

function openWork(
  work: GoogleCalendarWorkRow | null | undefined,
): GoogleCalendarWorkRow | null {
  return work && work.processed_at === null ? work : null;
}

export function deriveMirrorState(
  status: BookingStatus,
  tracked: GoogleCalendarEventRow | null | undefined,
  work: GoogleCalendarWorkRow | null | undefined,
): MirrorState | null {
  const queued = openWork(work);
  if (queued) {
    // Only confirmed Bookings and Bookings whose event still exists deserve a
    // queue badge; a pending Booking's no-op delete is not the owner's worry.
    if (!tracked && status !== "confirmed") return null;
    return queued.last_error !== "" ? "failed" : "pending";
  }
  // A tracked event is the only evidence Google has this Booking, and a
  // non-confirmed Booking with one is a delete that never ran, not a success.
  if (tracked) return status === "confirmed" ? "synced" : null;
  return null;
}

/** Derive every loaded Booking's state; orphaned tracked rows stay hidden. */
export function indexMirrorStates(
  bookings: readonly Pick<Booking, "id" | "status">[],
  tracked: readonly GoogleCalendarEventRow[],
  work: readonly GoogleCalendarWorkRow[],
): Map<string, MirrorState | null> {
  const trackedByBooking = new Map(
    tracked.map((row) => [row.booking_id, row] as const),
  );
  const openByBooking = new Map(
    work
      .filter((row) => row.processed_at === null)
      .map((row) => [row.booking_id, row] as const),
  );
  return new Map(
    bookings.map((booking) => [
      booking.id,
      deriveMirrorState(
        booking.status,
        trackedByBooking.get(booking.id) ?? null,
        openByBooking.get(booking.id) ?? null,
      ),
    ]),
  );
}
