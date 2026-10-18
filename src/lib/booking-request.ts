/**
 * Public Booking Request helpers (booking-request-intake ticket 02).
 *
 * A client opens a Format Booking link, which carries a per-request token.
 * The page reads the request context through `get_booking_request` and sends
 * the client's own fields back through `submit_booking_request`. Both are
 * security-definer RPCs; the browser never touches the booking_requests table.
 *
 * This module mirrors the day-schedule seam: a pure, fail-closed mapper that
 * strips every key but the four context fields, a pure fail-closed payload
 * validator that re-enforces the SQL rules before the call, and thin
 * `RpcClient` wrappers that never swallow transport errors.
 */

import type { RpcClient } from "./month-availability";
import { validateRequestSlot } from "./admin/validate-booking-request";

export type BookingRequestState = "open" | "submitted" | "expired" | "missing";

/** The read-only form context for a token (state open only carries values). */
export interface BookingRequestContext {
  state: BookingRequestState;
  client_name: string | null;
  date: string | null; // "YYYY-MM-DD"
  start_time: string | null; // "HH:MM"
  end_time: string | null; // "HH:MM"
}

/** Client-owned fields, validated and trimmed, ready to send as p_payload. */
export interface ValidatedBookingRequestPayload {
  client_name: string;
  client_phone: string;
  event_type: string;
  headcount: number;
  venue: string;
  hairdo: string;
  notes: string;
  date: string | null; // "YYYY-MM-DD"
  start_time: string | null; // "HH:MM"
  end_time: string | null; // "HH:MM"
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const STATES: readonly BookingRequestState[] = [
  "open",
  "submitted",
  "expired",
  "missing",
];

// Caps mirror the SQL submit function exactly (and the 0015 column checks).
const NAME_MAX = 120;
const PHONE_MAX = 32;
const PHONE_MIN_DIGITS = 9;
const HEADCOUNT_MIN = 1;
const HEADCOUNT_MAX = 100;
const EVENT_TYPE_MAX = 100;
const VENUE_MAX = 200;
const HAIRDO_MAX = 100;
const NOTES_MAX = 1000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Accept null/undefined as null, reject any other non-string (fail closed). */
function nullableString(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`Invalid ${label} in booking request context`);
  }
  return value;
}

/**
 * Map a raw `get_booking_request` payload to the public context shape.
 *
 * Strips every key but state/client_name/date/start_time/end_time so no phone,
 * note, price, status, or accepted-booking id can ever reach the browser. Only
 * `state: "open"` may carry context; every other state resolves to nulls even
 * if the server payload leaks values, and the mapper fails closed on an
 * unknown state or a malformed prefill.
 */
export function mapBookingRequestContext(row: unknown): BookingRequestContext {
  if (!isObject(row)) throw new Error("Invalid booking request context");
  const { state } = row;
  if (
    typeof state !== "string" ||
    !(STATES as readonly string[]).includes(state)
  ) {
    throw new Error(`Unknown booking request state: ${String(state)}`);
  }
  const typedState = state as BookingRequestState;
  if (typedState !== "open") {
    return {
      state: typedState,
      client_name: null,
      date: null,
      start_time: null,
      end_time: null,
    };
  }

  const client_name = nullableString(row.client_name, "client_name");
  const date = nullableString(row.date, "date");
  const start_time = nullableString(row.start_time, "start_time");
  const end_time = nullableString(row.end_time, "end_time");

  if (date !== null && !DATE_RE.test(date)) {
    throw new Error(`Invalid date in booking request context: ${date}`);
  }
  if (start_time !== null && !HHMM_RE.test(start_time)) {
    throw new Error(`Invalid start time in booking request context: ${start_time}`);
  }
  if (end_time !== null && !HHMM_RE.test(end_time)) {
    throw new Error(`Invalid end time in booking request context: ${end_time}`);
  }
  if (start_time !== null && end_time !== null && !(start_time < end_time)) {
    throw new Error("Invalid start/end in booking request context");
  }

  return { state: typedState, client_name, date, start_time, end_time };
}

function requiredName(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Nama klien tidak boleh kosong");
  }
  const name = value.trim();
  if (!name) throw new Error("Nama klien tidak boleh kosong");
  if (name.length > NAME_MAX) {
    throw new Error(`Nama klien maksimal ${NAME_MAX} karakter`);
  }
  return name;
}

function requiredPhone(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Nomor telepon/WA klien tidak valid (minimal 9 digit)");
  }
  const phone = value.trim();
  if (phone.length > PHONE_MAX) {
    throw new Error(`Nomor telepon/WA klien maksimal ${PHONE_MAX} karakter`);
  }
  if (phone.replace(/\D/g, "").length < PHONE_MIN_DIGITS) {
    throw new Error("Nomor telepon/WA klien tidak valid (minimal 9 digit)");
  }
  return phone;
}

function requiredHeadcount(value: unknown): number {
  let count: number;
  if (typeof value === "number") {
    count = value;
  } else if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    count = Number(value.trim());
  } else {
    throw new Error("Jumlah orang harus angka minimal 1");
  }
  if (!Number.isInteger(count) || count < HEADCOUNT_MIN) {
    throw new Error("Jumlah orang harus angka minimal 1");
  }
  if (count > HEADCOUNT_MAX) {
    throw new Error(`Jumlah orang maksimal ${HEADCOUNT_MAX}`);
  }
  return count;
}

function optionalText(value: unknown, max: number, label: string): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error(`${label} tidak valid`);
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new Error(`${label} maksimal ${max} karakter`);
  }
  return trimmed;
}

/** "" / null / undefined are absent; any other non-string is a malformed slot. */
function slotValue(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new Error(`${label} tidak valid`);
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Fail-closed validation of the client-owned payload. Mirrors the SQL submit
 * function's rules and caps (name <= 120 trimmed, phone >= 9 digits and <= 32
 * chars, headcount integer 1..100, per-field optional slot with YYYY-MM-DD +
 * strict HH:MM + start < end only when both times are present, event_type/
 * hairdo <= 100, venue <= 200, notes <= 1000) so a bad or oversized payload is
 * rejected before the RPC. Unknown keys are stripped: only the ten client-owned
 * columns are ever returned.
 */
export function validateBookingRequestPayload(
  input: unknown,
): ValidatedBookingRequestPayload {
  if (!isObject(input)) throw new Error("Data permintaan tidak valid");

  const client_name = requiredName(input.client_name);
  const client_phone = requiredPhone(input.client_phone);
  const headcount = requiredHeadcount(input.headcount);
  const event_type = optionalText(input.event_type, EVENT_TYPE_MAX, "Jenis acara");
  const venue = optionalText(input.venue, VENUE_MAX, "Lokasi");
  const hairdo = optionalText(input.hairdo, HAIRDO_MAX, "Model rambut");
  const notes = optionalText(input.notes, NOTES_MAX, "Catatan");

  // Each field is optional on its own; slotValue fails closed on a non-string
  // and the shared validator enforces the formats and start < end.
  const date = slotValue(input.date, "Tanggal permintaan");
  const start_time = slotValue(input.start_time, "Jam permintaan");
  const end_time = slotValue(input.end_time, "Jam permintaan");
  const slot = validateRequestSlot({ date, start_time, end_time });

  return {
    client_name,
    client_phone,
    event_type,
    headcount,
    venue,
    hairdo,
    notes,
    date: slot.date,
    start_time: slot.start_time,
    end_time: slot.end_time,
  };
}

export type SubmitBookingRequestReason =
  | "not_found"
  | "expired"
  | "already_submitted"
  | "invalid_payload";

/** Distinct outcomes the page renders as different states. */
export type SubmitBookingRequestOutcome =
  | { ok: true; state: "submitted" }
  | { ok: false; reason: SubmitBookingRequestReason };

const SUBMIT_REASONS: readonly SubmitBookingRequestReason[] = [
  "not_found",
  "expired",
  "already_submitted",
  "invalid_payload",
];

function requireToken(token: string): void {
  if (!token || !token.trim()) throw new Error("Token permintaan tidak valid");
}

/**
 * Public request-context read for the `get_booking_request` RPC. Calls the
 * RPC and validates the payload on the way out; a transport/RPC error is
 * thrown, never swallowed.
 */
export async function readBookingRequest(
  client: RpcClient,
  token: string,
): Promise<BookingRequestContext> {
  requireToken(token);
  const { data, error } = await client.rpc("get_booking_request", {
    p_token: token,
  });
  if (error) throw new Error(`Booking request RPC failed: ${error.message}`);
  return mapBookingRequestContext(data);
}

function mapSubmitBookingRequestResult(
  data: unknown,
): SubmitBookingRequestOutcome {
  if (!isObject(data)) {
    throw new Error("Invalid submit booking request result");
  }
  if (data.ok === true) {
    if (data.state !== "submitted") {
      throw new Error("Invalid submit booking request result");
    }
    return { ok: true, state: "submitted" };
  }
  if (data.ok === false) {
    if (
      typeof data.reason !== "string" ||
      !(SUBMIT_REASONS as readonly string[]).includes(data.reason)
    ) {
      throw new Error("Invalid submit booking request result");
    }
    return { ok: false, reason: data.reason as SubmitBookingRequestReason };
  }
  throw new Error("Invalid submit booking request result");
}

/**
 * Public request submit for the `submit_booking_request` RPC. Validates the
 * payload fail-closed BEFORE the call (same rules/caps as the SQL), forwards
 * only the ten client-owned fields, and returns the four known refusals
 * distinctly; only a transport/RPC error or a malformed response throws.
 */
export async function submitBookingRequest(
  client: RpcClient,
  token: string,
  payload: unknown,
): Promise<SubmitBookingRequestOutcome> {
  requireToken(token);
  const validated = validateBookingRequestPayload(payload);
  const { data, error } = await client.rpc("submit_booking_request", {
    p_token: token,
    p_payload: validated,
  });
  if (error) {
    throw new Error(`Submit booking request RPC failed: ${error.message}`);
  }
  return mapSubmitBookingRequestResult(data);
}
