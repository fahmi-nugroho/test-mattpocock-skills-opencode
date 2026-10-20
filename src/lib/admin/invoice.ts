/**
 * Pure Invoice helpers (invoice-and-booking-filter ticket 02).
 *
 * No React and no Supabase: the number's shape and year, the derived payment
 * position, the prospective snapshot, and the issuing guard the dialog shows.
 * Everything the database must never break is enforced again in 0018; these
 * helpers mirror it for the screen and add the duplicate rule that only the
 * screen can see (there is one admin and no concurrent editor).
 */

import type { Booking, Invoice } from "../supabase/database";

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The year encoded in an Invoice number, read from its issue date. */
export function invoiceYear(issuedOn: string): number {
  const match = DATE_KEY_RE.exec(issuedOn);
  if (!match) {
    throw new Error(`Tanggal terbit tidak valid: ${issuedOn}`);
  }
  return Number(match[1]);
}

/**
 * Format a sequence + issue date as the one business-wide `invc-NN/YYYY`
 * series. The year comes from the issue date, so the series restarts each
 * January and a number can never be moved into another year.
 */
export function formatInvoiceNumber(seq: number, issuedOn: string): string {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`Nomor urut invoice tidak valid: ${seq}`);
  }
  return `invc-${String(seq).padStart(2, "0")}/${invoiceYear(issuedOn)}`;
}

/** Derived, never stored: `Lunas` once the DP reaches the subtotal. */
export type PaymentStatus = "Lunas" | "DP diterima";

export interface PaymentPosition {
  remaining: number;
  status: PaymentStatus;
}

/**
 * The payment position printed on an Invoice: the balance is always subtotal
 * minus DP, and the status is `Lunas` when the DP is at least the subtotal.
 */
export function paymentPosition(
  subtotal: number,
  dpAmount: number,
): PaymentPosition {
  return {
    remaining: subtotal - dpAmount,
    status: dpAmount >= subtotal ? "Lunas" : "DP diterima",
  };
}

/**
 * The two states an Invoice can be in, read off `sent_at`. Marking sent is
 * always an explicit admin action, never a side effect of sharing.
 */
export function invoiceIsSent(invoice: Invoice): boolean {
  return invoice.sent_at !== null;
}

export function invoiceSentLabel(invoice: Invoice): string {
  return invoiceIsSent(invoice) ? "Terkirim" : "Belum dikirim";
}

/** Newest first within the one series: later year, then higher sequence. */
export function sortInvoicesNewestFirst(
  invoices: readonly Invoice[],
): Invoice[] {
  return [...invoices].sort(
    (a, b) =>
      b.year - a.year ||
      b.seq - a.seq ||
      b.created_at.localeCompare(a.created_at),
  );
}

/**
 * Group every loaded Invoice by its Booking, each group newest first, so the
 * booking row's count/newest and the dialog's list read the same order and a
 * later Booking edit cannot change either.
 */
export function indexInvoicesByBooking(
  invoices: readonly Invoice[],
): Map<string, Invoice[]> {
  const grouped = new Map<string, Invoice[]>();
  for (const invoice of sortInvoicesNewestFirst(invoices)) {
    const rows = grouped.get(invoice.booking_id);
    if (rows) rows.push(invoice);
    else grouped.set(invoice.booking_id, [invoice]);
  }
  return grouped;
}

/** Every displayed field copied into an Invoice, plus both of its dates. */
const SNAPSHOT_KEYS = [
  "client_name",
  "client_phone",
  "service_name",
  "event_type",
  "headcount",
  "venue",
  "hairdo",
  "booking_date",
  "start_time",
  "end_time",
  "subtotal",
  "dp_amount",
  "issued_on",
  "due_on",
] as const;

export type InvoiceSnapshot = Pick<
  Invoice,
  (typeof SNAPSHOT_KEYS)[number]
>;

function pickSnapshot(source: InvoiceSnapshot): InvoiceSnapshot {
  return Object.fromEntries(
    SNAPSHOT_KEYS.map((key) => [key, source[key]]),
  ) as InvoiceSnapshot;
}

type SnapshotBooking = Pick<
  Booking,
  | "client_name"
  | "client_phone"
  | "event_type"
  | "headcount"
  | "venue"
  | "hairdo"
  | "date"
  | "start_time"
  | "end_time"
  | "total_price"
  | "dp_amount"
>;

/**
 * The snapshot the dialog is about to issue. The database builds the saved
 * snapshot itself; this mirror exists only so the duplicate rule can compare
 * what the admin is looking at with what is already stored.
 */
export function buildInvoiceSnapshot(
  booking: SnapshotBooking,
  serviceName: string,
  issuedOn: string,
  dueOn: string,
): InvoiceSnapshot {
  return {
    client_name: booking.client_name,
    client_phone: booking.client_phone,
    service_name: serviceName,
    event_type: booking.event_type,
    headcount: booking.headcount,
    venue: booking.venue,
    hairdo: booking.hairdo,
    booking_date: booking.date,
    start_time: booking.start_time,
    end_time: booking.end_time,
    subtotal: booking.total_price ?? 0,
    dp_amount: booking.dp_amount,
    issued_on: issuedOn,
    due_on: dueOn,
  };
}

/** Read the frozen snapshot off a saved Invoice, never off the live Booking. */
export function invoiceSnapshotOf(invoice: Invoice): InvoiceSnapshot {
  return pickSnapshot(invoice);
}

function snapshotsMatch(a: InvoiceSnapshot, b: InvoiceSnapshot): boolean {
  return SNAPSHOT_KEYS.every((key) => a[key] === b[key]);
}

export interface InvoiceIssueInput {
  booking: SnapshotBooking &
    Pick<Booking, "status">;
  serviceName: string;
  issuedOn: string;
  dueOn: string;
}

/**
 * Why the dialog cannot issue this Invoice, in plain Indonesian, or null when
 * it can. Mirrors the database's preconditions and adds the duplicate rule:
 * an Invoice identical to the newest one must be resent, never renumbered.
 * The newest Invoice is the dialog's already-loaded row, so this stays pure.
 */
export function invoiceIssueRefusal(
  input: InvoiceIssueInput,
  newest: Invoice | null,
): string | null {
  const { booking, serviceName, issuedOn, dueOn } = input;

  if (booking.status === "cancelled") {
    return "Invoice tidak dapat dibuat untuk booking yang dibatalkan.";
  }
  if (booking.total_price === null) {
    return "Booking belum memiliki total yang disepakati.";
  }
  if (booking.dp_amount <= 0) {
    return "Booking belum memiliki DP yang tercatat.";
  }
  if (booking.dp_amount > booking.total_price) {
    return "DP tidak boleh melebihi total yang disepakati.";
  }
  if (dueOn < issuedOn) {
    return "Tanggal jatuh tempo tidak boleh sebelum tanggal terbit.";
  }

  if (newest) {
    const prospective = buildInvoiceSnapshot(
      booking,
      serviceName,
      issuedOn,
      dueOn,
    );
    if (snapshotsMatch(prospective, invoiceSnapshotOf(newest))) {
      return `Invoice baru akan sama persis dengan ${newest.number}. Kirim ulang invoice itu alih-alih membuat nomor baru.`;
    }
  }

  return null;
}
