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
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const STATUSES: readonly BookingStatus[] = [
  "pending",
  "confirmed",
  "cancelled",
];

/**
 * Validate the admin booking form (ticket 07). Mirrors the SQL CHECKs
 * (0001_schema.sql: HH:MM shape, start < end, status set) so bad rows
 * are rejected before a DB write; trims names/notes and defaults
 * notes to "" (same shape as the bookings table). Overlap is checked
 * separately in booking-conflicts.ts after fetching same-day siblings.
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
  return {
    date: input.date,
    start_time: input.start_time,
    end_time: input.end_time,
    service_id,
    client_name,
    client_phone,
    notes: (input.notes ?? "").trim(),
    status: input.status as BookingStatus,
  };
}
