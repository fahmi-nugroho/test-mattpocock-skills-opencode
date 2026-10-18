/**
 * Admin Booking Request helpers (booking-request-intake ticket 04).
 *
 * Pure, no React and no Supabase: derive a request's state from its token
 * bookkeeping columns, build the Format Booking link the admin sends, map a
 * request onto the existing admin booking form, and derive the money figures
 * that must never be stored (suggested total from service × headcount, and
 * the remaining balance as total − DP).
 */

import type { BookingRequest } from "../supabase/database";

/**
 * The derived state of a Booking Request, never a stored column:
 * - `accepted` — the admin linked it to a Booking (outranks everything);
 * - `expired` — the deadline passed; outranks `submitted` so the badge agrees
 *   with the accept guard;
 * - `submitted` — the client filled the form, the link is still accept-able;
 * - `open` — the link is live and waiting on the client.
 */
export type BookingRequestStatus =
  | "open"
  | "submitted"
  | "accepted"
  | "expired";

/** The subset of BookingRequest that state derivation reads. */
export type BookingRequestStateInput = Pick<
  BookingRequest,
  "submitted_at" | "accepted_booking_id" | "expires_at"
>;

/**
 * Derive the request state from the row's timestamps and the link.
 * A linked booking is the strongest signal (the request is spent), then
 * expiry, then an actual submission, so a submitted-but-expired request reads
 * `expired` — matching `linkBookingRequest`'s `expires_at > now` accept guard.
 * The clock is injected so tests pin it.
 */
export function deriveBookingRequestState(
  request: BookingRequestStateInput,
  now: Date,
): BookingRequestStatus {
  if (request.accepted_booking_id) return "accepted";
  if (new Date(request.expires_at) <= now) return "expired";
  if (request.submitted_at) return "submitted";
  return "open";
}

/** Join a base URL and a token into the public Format Booking link. */
export function buildFormatBookingLink(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/request/${token}`;
}

/**
 * The single home for every status switch: the admin badge label, the inline
 * hint for a request that cannot be accepted yet, and the accept-refusal
 * explanation. All copy is Indonesian; components only add styling.
 */
export const BOOKING_REQUEST_STATUS_LABEL: Record<
  BookingRequestStatus,
  string
> = {
  open: "Terbuka",
  submitted: "Terkirim",
  accepted: "Diterima",
  expired: "Kedaluwarsa",
};

/** Why a non-submitted request cannot be accepted (Indonesian, inline). */
export function bookingRequestRefusalHint(
  status: BookingRequestStatus,
): string {
  switch (status) {
    case "open":
      return "Menunggu klien mengirim form — belum bisa dijadikan booking.";
    case "expired":
      return "Link sudah kedaluwarsa — buat link baru untuk klien ini.";
    case "accepted":
      return "Sudah diterima menjadi booking.";
    default:
      return "Belum bisa dijadikan booking.";
  }
}

/**
 * The refusal explanation after a guarded accept matched nothing, keyed by the
 * state read back from the row.
 */
export function refusalMessage(status: BookingRequestStatus): string {
  switch (status) {
    case "accepted":
      return "Permintaan ini sudah diterima — tidak bisa diterima dua kali.";
    case "expired":
      return "Link permintaan sudah kedaluwarsa — tidak bisa diterima lagi.";
    case "submitted":
      // The guarded update already matched the accept-able state, so an
      // empty result here is a lost race, not a real refusal.
      return "Permintaan tidak bisa diterima saat ini — coba muat ulang.";
    default:
      return "Permintaan belum dikirim oleh klien — belum bisa dijadikan booking.";
  }
}

/**
 * The admin booking form's prefill shape. It mirrors only the booking form
 * fields the request actually supplies — a client submission never carries
 * money, status, service, or notes, and the form's own defaults already leave
 * those to the admin.
 */
export interface BookingPrefillDraft {
  client_name: string;
  client_phone: string;
  event_type: string;
  headcount: number;
  venue: string;
  hairdo: string;
  date: string;
  start_time: string;
  end_time: string;
}

/**
 * Map a submitted request onto a booking-form draft: carry the client's own
 * details and the requested slot only. An absent slot becomes "" so the
 * form's own defaults stand. It never carries a price, status, service, or
 * notes.
 */
export function requestToBookingDraft(
  request: BookingRequest,
): BookingPrefillDraft {
  return {
    client_name: request.client_name,
    client_phone: request.client_phone,
    event_type: request.event_type,
    headcount: request.headcount,
    venue: request.venue,
    hairdo: request.hairdo,
    date: request.date ?? "",
    start_time: request.start_time ?? "",
    end_time: request.end_time ?? "",
  };
}

/**
 * Suggest the total as service price × headcount. Returns null when there is
 * no usable price or headcount so the admin simply sees no suggestion; the
 * value is only ever a hint the admin can override or clear.
 */
export function suggestTotal(
  servicePriceIdr: number | null,
  headcount: number,
): number | null {
  if (servicePriceIdr === null || !Number.isFinite(servicePriceIdr)) {
    return null;
  }
  if (servicePriceIdr < 0) return null;
  if (!Number.isInteger(headcount) || headcount < 1) return null;
  return servicePriceIdr * headcount;
}

/**
 * The remaining balance total − DP, always derived and never stored. Null
 * while no total has been quoted (the DP is meaningless without a total).
 */
export function remainingBalance(
  totalPrice: number | null,
  dpAmount: number,
): number | null {
  if (totalPrice === null) return null;
  return totalPrice - dpAmount;
}
