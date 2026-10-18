/**
 * Admin Booking Request data access (booking-request-intake ticket 04).
 *
 * Mirrors admin-bookings.ts: a thin adapter over the typed client, injected
 * so the admin dashboard can be tested with a recording mock and so the
 * public form never sees these calls. The browser client is authenticated
 * (the booking_requests table has no anon policy).
 *
 * INTERPRETATION (ticket wording "expired or already-submitted request,
 * accepting is refused"): the one state you *do* accept is `submitted`, so
 * the guard is read as "expired or already-accepted". `linkBookingRequest`
 * accepts exactly the submitted, not-yet-accepted, not-expired request and
 * refuses every other state with an Indonesian explanation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingRequest, Database } from "./database";
import { insertRow } from "./admin-crud";
import {
  deriveBookingRequestState,
  type BookingRequestStatus,
} from "../admin/booking-request";

type TypedClient = SupabaseClient<Database>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export interface BookingRequestCreateInput {
  client_name?: string;
  date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

/** "" / null / undefined are absent; any other non-string is malformed. */
function normalizeSlot(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Admin request list (ticket 04): every request ordered newest first, so the
 * section shows the freshest submission at the top. Call with an
 * authenticated browser client; the table stays anon-denied.
 */
export async function listBookingRequestsAdmin(
  client: TypedClient,
): Promise<BookingRequest[]> {
  const loose = client as unknown as {
    from(t: string): {
      select(c: string): {
        order(
          c: string,
          o: { ascending: boolean },
        ): Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
  };
  const { data, error } = await loose
    .from("booking_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load booking requests: ${error.message}`);
  return Array.isArray(data) ? (data as BookingRequest[]) : [];
}

/**
 * Create a Format Booking request (ticket 04). Writes only the four
 * admin-supplied fields — token, timestamps, submitted_at, and the accepted
 * link are all database-generated. The optional client name is trimmed; the
 * requested slot is optional but all-or-nothing (date + start + end), with
 * the same YYYY-MM-DD / strict HH:MM / start < end rules as the public form,
 * rejected with an Indonesian message before any write.
 */
export async function createBookingRequest(
  client: TypedClient,
  input: BookingRequestCreateInput,
): Promise<BookingRequest> {
  const client_name = (input.client_name ?? "").trim();
  const date = normalizeSlot(input.date);
  const start_time = normalizeSlot(input.start_time);
  const end_time = normalizeSlot(input.end_time);

  if (date !== null || start_time !== null || end_time !== null) {
    if (date === null || start_time === null || end_time === null) {
      throw new Error("Tanggal dan jam permintaan harus diisi lengkap");
    }
    if (!DATE_RE.test(date)) {
      throw new Error("Tanggal permintaan harus format YYYY-MM-DD");
    }
    if (!HHMM_RE.test(start_time) || !HHMM_RE.test(end_time)) {
      throw new Error("Jam permintaan harus format HH:MM (00:00–23:59)");
    }
    if (!(start_time < end_time)) {
      throw new Error("Jam mulai harus sebelum jam selesai");
    }
  }

  return insertRow<BookingRequest>(
    client,
    "booking_requests",
    { client_name, date, start_time, end_time },
    "Gagal membuat permintaan",
  );
}

function refusalMessage(status: BookingRequestStatus): string {
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
 * Accept a submitted request into a booking (ticket 04): set
 * `accepted_booking_id` behind a race-safe guarded update that only matches
 * a request which is submitted, not yet accepted, and not expired. The
 * `accepted_booking_id` unique constraint makes a double accept impossible;
 * a unique violation is translated into the same refusal.
 *
 * On refusal this reads the row back to explain why in Indonesian (already
 * accepted / expired / not submitted). Deleting the booking later releases
 * the link (FK `on delete set null`), so the request becomes acceptable
 * again without any extra wiring.
 */
export async function linkBookingRequest(
  client: TypedClient,
  requestId: string,
  bookingId: string,
): Promise<BookingRequest> {
  const nowIso = new Date().toISOString();
  const loose = client as unknown as {
    from(t: string): {
      update(v: unknown): {
        eq(c: string, v: string): {
          not(c: string, op: string, v: null): {
            is(c: string, v: null): {
              gt(
                c: string,
                v: string,
              ): {
                select(): Promise<{
                  data: unknown;
                  error: { message: string } | null;
                }>;
              };
            };
          };
        };
      };
      select(c: string): {
        eq(c: string, v: string): {
          single(): Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    };
  };

  const { data, error } = await loose
    .from("booking_requests")
    .update({ accepted_booking_id: bookingId })
    .eq("id", requestId)
    .not("submitted_at", "is", null)
    .is("accepted_booking_id", null)
    .gt("expires_at", nowIso)
    .select();

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      throw new Error(
        "Permintaan ini sudah diterima — tidak bisa diterima dua kali.",
      );
    }
    throw new Error(`Gagal menerima permintaan: ${error.message}`);
  }

  const rows = Array.isArray(data) ? (data as BookingRequest[]) : [];
  if (rows.length > 0) return rows[0];

  // The guard matched nothing: read the row back to say which state blocked
  // acceptance, in Indonesian.
  const { data: current, error: readError } = await loose
    .from("booking_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (readError) {
    throw new Error(`Gagal memuat permintaan: ${readError.message}`);
  }
  throw new Error(refusalMessage(deriveBookingRequestState(current as BookingRequest, new Date())));
}
