/**
 * Admin Booking Request helpers (booking-request-intake ticket 04).
 *
 * Pure, no React and no Supabase: derive a request's state from its token
 * bookkeeping columns, build the Format Booking link the admin sends, map a
 * request onto the existing admin booking form, and derive the money figures
 * that must never be stored (suggested total from service × headcount, and
 * the remaining balance as total − DP).
 */

import type { BookingRequest, BookingStatus } from "../supabase/database";

/**
 * The derived state of a Booking Request, never a stored column:
 * - `accepted` — the admin linked it to a Booking (outranks everything);
 * - `submitted` — the client filled the form, the link is still accept-able;
 * - `expired` — the deadline passed before the client submitted;
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
 * A linked booking is the strongest signal (the request is spent), then an
 * actual submission, then expiry. The clock is injected so tests pin it.
 */
export function deriveBookingRequestState(
  request: BookingRequestStateInput,
  now: Date,
): BookingRequestStatus {
  if (request.accepted_booking_id) return "accepted";
  if (request.submitted_at) return "submitted";
  if (new Date(request.expires_at) <= now) return "expired";
  return "open";
}

/** Join a base URL and a token into the public Format Booking link. */
export function buildFormatBookingLink(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/request/${token}`;
}

/**
 * The admin booking form's prefill shape. It mirrors the booking form's
 * fields but deliberately leaves service, notes, price, DP, and status to
 * the admin — a client submission never carries money or status.
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
  service_id: string | null;
  notes: string;
  total_price: number | null;
  dp_amount: number;
  status: BookingStatus;
}

/**
 * Map a submitted request onto a booking-form draft: carry the client's own
 * details and the requested slot, and leave service, notes, price, DP, and
 * status untouched. An absent slot becomes "" so the form's own defaults
 * stand. It never carries a price.
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
    service_id: null,
    notes: "",
    total_price: null,
    dp_amount: 0,
    status: "pending",
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
