import type { BookingService, BookingStatus, ServicePricing } from "../supabase/database";
import { REFERENCE_MAX, isStyle } from "../style-reference";

type SelectedService = Pick<BookingService, "id" | "pricing">;

export interface BookingInput {
  date: string;
  start_time: string;
  end_time: string;
  selected_services?: SelectedService[];
  client_name: string;
  client_phone: string;
  notes?: string;
  status: BookingStatus | string;
  event_type?: string;
  headcount?: number;
  venue?: string;
  hairdo?: string;
  reference?: string;
  total_price?: number | null;
  dp_amount?: number;
  bagian_mua?: number | null;
}

export interface ValidatedBookingInput {
  date: string;
  start_time: string;
  end_time: string;
  selected_services: SelectedService[];
  client_name: string;
  client_phone: string;
  notes: string;
  status: BookingStatus;
  event_type: string;
  headcount: number;
  venue: string;
  hairdo: string;
  reference: string;
  total_price: number | null;
  dp_amount: number;
  bagian_mua: number | null;
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
const MAX_IDR = 2_147_483_647;

export function servicePriceTotal(items: readonly { pricing?: ServicePricing }[]): number | null {
  if (items.length === 0) return null;
  let total = 0;
  for (const { pricing } of items) {
    if (!pricing) return null;
    const { unit_price, quantity } = pricing;
    if (!Number.isInteger(unit_price) || unit_price < 0 ||
        !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_IDR) return null;
    total += unit_price * quantity;
    if (total > MAX_IDR) return null;
  }
  return total;
}

export function validateBagianMua(amount: number | null, total: number | null): void {
  if (amount === null) return;
  if (total === null) {
    throw new Error("Isi total harga sebelum mengisi Bagian MUA.");
  }
  if (!Number.isInteger(amount) || amount < 0 || amount > total) {
    throw new Error("Bagian MUA harus dalam rupiah bulat, dari Rp0 hingga total harga.");
  }
}

/**
 * Validate the admin booking form (ticket 07, extended tickets 04 and 02).
 * Mirrors the SQL CHECKs (0001_schema.sql + 0015 columns: HH:MM shape,
 * start < end, status set, headcount >= 1, total/DP >= 0, field caps) so bad
 * rows are rejected before a DB write; trims names/notes and defaults notes to
 * "" (same shape as the bookings table). The Style is optional ('' allowed) but
 * otherwise exactly hijabdo|hairdo, and the Reference is optional up to 300
 * chars — the same two-value set and cap the public validator and the 0017
 * submit function enforce. Overlap is checked separately in booking-conflicts.ts
 * after fetching same-day siblings.
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
  const services = new Map<string, SelectedService>();
  for (const service of input.selected_services ?? []) {
    if (!services.has(service.id)) services.set(service.id, service);
  }
  const selected_services = [...services.values()];

  const event_type = (input.event_type ?? "").trim();
  if (event_type.length > EVENT_TYPE_MAX) {
    throw new Error(`Jenis acara maksimal ${EVENT_TYPE_MAX} karakter`);
  }
  const venue = (input.venue ?? "").trim();
  if (venue.length > VENUE_MAX) {
    throw new Error(`Lokasi maksimal ${VENUE_MAX} karakter`);
  }
  // Style is optional: '' means "not known" (a hand-typed booking may predate
  // the client's choice). Any other value must be exactly one of the two,
  // matching the public validator and the SQL submit function (untrimmed enum).
  const hairdo = input.hairdo ?? "";
  if (hairdo !== "" && !isStyle(hairdo)) {
    throw new Error("Gaya rambut harus Hijabdo atau Hairdo");
  }
  const reference = (input.reference ?? "").trim();
  if (reference.length > REFERENCE_MAX) {
    throw new Error(`Referensi maksimal ${REFERENCE_MAX} karakter`);
  }

  const headcount = input.headcount ?? 1;
  if (!Number.isInteger(headcount) || headcount < 1) {
    throw new Error("Jumlah orang harus angka bulat minimal 1");
  }

  const itemized = selected_services.some(({ pricing }) => pricing !== undefined);
  const serviceTotal = servicePriceTotal(selected_services);
  if (itemized && serviceTotal === null) {
    throw new Error("Isi harga satuan dan jumlah bulat untuk semua layanan. Pastikan total harga tidak melebihi Rp2.147.483.647.");
  }
  const total_price = itemized ? serviceTotal : input.total_price ?? null;
  if (
    total_price !== null &&
    (!Number.isInteger(total_price) || total_price < 0)
  ) {
    throw new Error("Total harga harus angka minimal 0");
  }
  if (selected_services.length > 1 && total_price === null) {
    throw new Error("Total harga wajib diisi jika memilih lebih dari satu layanan");
  }

  const dp_amount = input.dp_amount ?? 0;
  if (!Number.isInteger(dp_amount) || dp_amount < 0) {
    throw new Error("DP harus angka minimal 0");
  }
  const bagian_mua = input.bagian_mua ?? null;
  validateBagianMua(bagian_mua, total_price);

  return {
    date: input.date,
    start_time: input.start_time,
    end_time: input.end_time,
    selected_services,
    client_name,
    client_phone,
    notes: (input.notes ?? "").trim(),
    status: input.status as BookingStatus,
    event_type,
    headcount,
    venue,
    hairdo,
    reference,
    total_price,
    dp_amount,
    bagian_mua,
  };
}
