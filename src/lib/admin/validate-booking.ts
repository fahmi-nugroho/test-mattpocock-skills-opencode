import type { BookingStatus } from "../supabase/database";

export interface BookingInput {
  date: string;
  start_time: string;
  end_time: string;
  service_id?: string | null;
  client_name: string;
  client_phone: string;
  notes?: string;
  status: BookingStatus | string;
  event_type?: string;
  headcount?: number;
  venue?: string;
  hairdo?: string;
  total_price?: number | null;
  dp_amount?: number;
}

export interface ValidatedBookingInput {
  date: string;
  start_time: string;
  end_time: string;
  service_id: string | null;
  client_name: string;
  client_phone: string;
  notes: string;
  status: BookingStatus;
  event_type: string;
  headcount: number;
  venue: string;
  hairdo: string;
  total_price: number | null;
  dp_amount: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const STATUSES: readonly BookingStatus[] = [
  "pending",
  "confirmed",
  "cancelled",
];
// Caps mirror the 0015 column checks.
const EVENT_TYPE_MAX = 100;
const VENUE_MAX = 200;
const HAIRDO_MAX = 100;

/**
 * Validate the admin booking form (ticket 07, extended ticket 04). Mirrors
 * the SQL CHECKs (0001_schema.sql + 0015 columns: HH:MM shape, start < end,
 * status set, headcount >= 1, total/DP >= 0, field caps) so bad rows are
 * rejected before a DB write; trims names/notes and defaults notes to ""
 * (same shape as the bookings table). Overlap is checked separately in
 * booking-conflicts.ts after fetching same-day siblings.
 */
export function validateBookingInput(
  input: BookingInput,
): ValidatedBookingInput {
  if (!DATE_RE.test(input.date)) {
    throw new Error("Tanggal booking harus format YYYY-MM-DD");
  }
  if (!HHMM_RE.test(input.start_time) || !HHMM_RE.test(input.end_time)) {
    throw new Error("Jam booking harus format HH:MM (00:00–23:59)");
  }
  if (!(input.start_time < input.end_time)) {
    throw new Error("Jam mulai harus sebelum jam selesai");
  }
  const client_name = input.client_name.trim();
  if (!client_name) {
    throw new Error("Nama klien tidak boleh kosong");
  }
  const client_phone = input.client_phone.trim();
  if (client_phone.replace(/\D/g, "").length < 9) {
    throw new Error("Nomor telepon/WA klien tidak valid (minimal 9 digit)");
  }
  if (!(STATUSES as readonly string[]).includes(input.status)) {
    throw new Error("Status booking harus pending, confirmed, atau cancelled");
  }
  const service_id =
    input.service_id === undefined || input.service_id === null
      ? null
      : input.service_id.trim() === ""
        ? null
        : input.service_id.trim();

  const event_type = (input.event_type ?? "").trim();
  if (event_type.length > EVENT_TYPE_MAX) {
    throw new Error(`Jenis acara maksimal ${EVENT_TYPE_MAX} karakter`);
  }
  const venue = (input.venue ?? "").trim();
  if (venue.length > VENUE_MAX) {
    throw new Error(`Lokasi maksimal ${VENUE_MAX} karakter`);
  }
  const hairdo = (input.hairdo ?? "").trim();
  if (hairdo.length > HAIRDO_MAX) {
    throw new Error(`Model rambut maksimal ${HAIRDO_MAX} karakter`);
  }

  const headcount = input.headcount ?? 1;
  if (!Number.isInteger(headcount) || headcount < 1) {
    throw new Error("Jumlah orang harus angka bulat minimal 1");
  }

  const total_price =
    input.total_price === undefined || input.total_price === null
      ? null
      : input.total_price;
  if (
    total_price !== null &&
    (!Number.isInteger(total_price) || total_price < 0)
  ) {
    throw new Error("Total harga harus angka minimal 0");
  }

  const dp_amount = input.dp_amount ?? 0;
  if (!Number.isInteger(dp_amount) || dp_amount < 0) {
    throw new Error("DP harus angka minimal 0");
  }

  return {
    date: input.date,
    start_time: input.start_time,
    end_time: input.end_time,
    service_id,
    client_name,
    client_phone,
    notes: (input.notes ?? "").trim(),
    status: input.status as BookingStatus,
    event_type,
    headcount,
    venue,
    hairdo,
    total_price,
    dp_amount,
  };
}
