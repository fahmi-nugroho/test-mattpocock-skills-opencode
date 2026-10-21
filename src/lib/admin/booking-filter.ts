/**
 * Booking status filter helpers (invoice-and-booking-filter ticket 06).
 *
 * Pure: no React and no Supabase. The status labels live here so the row
 * badge, the status dropdown and the filter chips all read one vocabulary —
 * a chip cannot drift from the row it selects.
 */

import type { Booking, BookingStatus } from "../supabase/database";

/** The statuses a Booking can hold, in the order the admin reads them. */
export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
] as const;

/** The one label per status the rows and every status control print. */
export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Menunggu",
  confirmed: "Terkonfirmasi",
  cancelled: "Dibatalkan",
};

/**
 * The ordered vocabulary the filter chips offer: `all` (show everything) then
 * one per stored status. The type is read off the list so the two cannot
 * drift.
 */
export const BOOKING_FILTERS = ["all", ...BOOKING_STATUSES] as const;

export type BookingFilter = (typeof BOOKING_FILTERS)[number];

/**
 * Chip copy. The status chips reuse the row labels verbatim, and `all` is the
 * show-everything chip, so a chip and a row can never tell two stories.
 */
export const BOOKING_FILTER_LABEL: Record<BookingFilter, string> = {
  all: "Semua",
  pending: BOOKING_STATUS_LABEL.pending,
  confirmed: BOOKING_STATUS_LABEL.confirmed,
  cancelled: BOOKING_STATUS_LABEL.cancelled,
};

/**
 * The pure status filter: keep the Bookings whose stored status matches the
 * chosen chip. `all` keeps the input order untouched; the manager runs this
 * before the search and the Mendatang/Riwayat split, so both narrow the
 * already-filtered rows.
 */
export function filterBookings<T extends Pick<Booking, "status">>(
  bookings: readonly T[],
  filter: BookingFilter,
): T[] {
  if (filter === "all") return [...bookings];
  return bookings.filter((booking) => booking.status === filter);
}
