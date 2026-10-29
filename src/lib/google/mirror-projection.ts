import type { Booking, BookingStatus } from "../supabase/database";
import { formatIDR } from "../format";
import { isStyle, STYLE_COPY } from "../style-reference";
import type { GoogleCalendarEventDraft } from "./port";

/**
 * The pure projection and planning seam for the Calendar Mirror (ticket 02).
 *
 * Nothing here calls Google or Supabase: a Booking goes in and the event body
 * comes out, or a set of Bookings plus tracked events goes in and the mirror
 * work comes out. Keeping it pure makes the two decisions the owner can see —
 * what the event says, and which Booking deserves which action — testable
 * without credentials or a live calendar.
 */

/** The WIB calendar date ("YYYY-MM-DD") for an instant. */
export function mirrorTodayKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function text(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function styleLabel(hairdo: string): string {
  return isStyle(hairdo) ? STYLE_COPY[hairdo].label : hairdo;
}

/** IDR text with a plain space, so Google's description stays ordinary text. */
function idr(amount: number): string {
  return formatIDR(amount).replace(/\u00a0/g, " ");
}

function jakartaDateTime(date: string, time: string): string {
  // Bookings store date + "HH:MM" text (0001), so both halves are already
  // wall-clock WIB values; the explicit +07:00 keeps them that way even when
  // the server or the phone reading the event is in another zone.
  return `${date}T${time}:00+07:00`;
}

/**
 * A Booking plus its linked service name -> the Google event body.
 *
 * The title always names the client and falls back from the service to the
 * event type and finally to "Booking", so it is never blank. The description
 * carries the Booking's own fields only: an Invoice number, bank details, or
 * anything else copied into an Invoice never belongs in the mirror.
 */
export function buildMirrorEvent(
  booking: Booking,
  serviceName: string | null,
): GoogleCalendarEventDraft {
  const service = text(serviceName);
  const eventType = text(booking.event_type);
  const venue = text(booking.venue);
  const reference = text(booking.reference);
  const notes = text(booking.notes);
  const category = service || eventType || "Booking";

  const lines: string[] = [
    `Nama klien: ${booking.client_name}`,
    `No. HP: ${booking.client_phone}`,
  ];
  if (service) lines.push(`Layanan: ${service}`);
  if (eventType) lines.push(`Jenis acara: ${eventType}`);
  lines.push(`Jumlah orang: ${booking.headcount}`);
  if (venue) lines.push(`Lokasi: ${venue}`);
  if (booking.hairdo) lines.push(`Gaya rambut: ${styleLabel(booking.hairdo)}`);
  if (reference) lines.push(`Referensi: ${reference}`);
  if (notes) lines.push(`Catatan: ${notes}`);
  if (booking.total_price !== null) {
    lines.push(`Total: ${idr(booking.total_price)}`);
  }
  lines.push(`DP: ${idr(booking.dp_amount)}`);
  lines.push(`ID Booking: ${booking.id}`);

  const event: GoogleCalendarEventDraft = {
    summary: `${booking.client_name} — ${category}`,
    description: lines.join("\n"),
    start: {
      dateTime: jakartaDateTime(booking.date, booking.start_time),
      timeZone: "Asia/Jakarta",
    },
    end: {
      dateTime: jakartaDateTime(booking.date, booking.end_time),
      timeZone: "Asia/Jakarta",
    },
    status: "confirmed",
    transparency: "opaque",
    // Private marker so a retry can find an event it already created even if
    // the tracked row was not written. No attendees and no reminders: the
    // calendar default applies and the client is never invited.
    extendedProperties: { private: { muaBookingId: booking.id } },
  };
  if (venue) event.location = venue;
  return event;
}

export type MirrorAction = "create" | "update" | "delete";

export interface MirrorPlannedWork {
  bookingId: string;
  action: MirrorAction;
}

/** The minimum a planner needs from a Booking row. */
export interface MirrorPlannerBooking {
  id: string;
  date: string; // "YYYY-MM-DD"
  status: BookingStatus;
}

/** The minimum a planner needs from a tracked-event row. */
export interface MirrorTrackedRef {
  booking_id: string;
  google_event_id: string;
}

function trackedIds(tracked: readonly MirrorTrackedRef[]): Set<string> {
  return new Set(tracked.map((row) => row.booking_id));
}

/**
 * Confirmed Bookings plus tracked events -> create / update / delete work.
 *
 * Only the today-forward window is considered, so a hand edit or a hard
 * delete cannot rewrite history. A tracked event with no Booking row is an
 * orphan left by a hard delete and is scheduled for deletion; its tracked row
 * is removed only after Google confirms that deletion.
 */
export function planMirrorWork(
  bookings: readonly MirrorPlannerBooking[],
  tracked: readonly MirrorTrackedRef[],
  todayKey: string,
): MirrorPlannedWork[] {
  const hasTracked = trackedIds(tracked);
  const known = new Set(bookings.map((booking) => booking.id));
  const work: MirrorPlannedWork[] = [];

  for (const booking of bookings) {
    const future = booking.date >= todayKey;
    if (!future) continue;
    if (booking.status === "confirmed") {
      work.push({
        bookingId: booking.id,
        action: hasTracked.has(booking.id) ? "update" : "create",
      });
    } else if (hasTracked.has(booking.id)) {
      work.push({ bookingId: booking.id, action: "delete" });
    }
  }

  for (const row of tracked) {
    if (!known.has(row.booking_id)) {
      work.push({ bookingId: row.booking_id, action: "delete" });
    }
  }

  return work;
}

/**
 * Backfill planning: create missing events for confirmed Bookings dated today
 * or later in WIB. Past Bookings, non-confirmed rows, and already-tracked
 * Bookings are no-ops, which makes a second run create nothing new.
 */
export function planBackfill(
  bookings: readonly MirrorPlannerBooking[],
  tracked: readonly MirrorTrackedRef[],
  todayKey: string,
): MirrorPlannedWork[] {
  // The full planner already encodes the cut-off and the already-tracked
  // no-op; backfill is exactly its create half, so the two can never drift.
  return planMirrorWork(bookings, tracked, todayKey).filter(
    (work) => work.action === "create",
  );
}
