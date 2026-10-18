/**
 * Accept-request prefill signal (booking-request-intake ticket 04).
 *
 * All admin sections stay mounted on the dashboard, so "Jadikan Booking" in
 * RequestsManager cannot hold a reference to the BookingsManager form. It
 * dispatches this window event with the request draft; BookingsManager
 * listens and fills its create form. No realtime, no push — a same-page
 * hand-off only.
 */

import type { BookingPrefillDraft } from "./booking-request";

export const ACCEPT_REQUEST_EVENT = "mua:accept-request";

export interface AcceptRequestDetail {
  requestId: string;
  draft: BookingPrefillDraft;
}

export function notifyAcceptRequest(detail: AcceptRequestDetail): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ACCEPT_REQUEST_EVENT, { detail }));
  }
}
