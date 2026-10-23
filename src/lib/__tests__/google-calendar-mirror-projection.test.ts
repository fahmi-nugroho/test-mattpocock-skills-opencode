import { describe, expect, it } from "vitest";
import {
  buildMirrorEvent,
  mirrorTodayKey,
  planBackfill,
  planMirrorWork,
  type MirrorPlannerBooking,
  type MirrorTrackedRef,
} from "../google/mirror-projection";
import type { Booking } from "../supabase/database";

const BOOKING: Booking = {
  id: "b-1",
  date: "2026-11-01",
  start_time: "09:00",
  end_time: "11:30",
  service_id: "s-1",
  client_name: "Sinta",
  client_phone: "081234567890",
  notes: "Datang lebih awal",
  status: "confirmed",
  event_type: "Wisuda",
  headcount: 2,
  venue: "Gedung Serbaguna, Bandung",
  hairdo: "hijabdo",
  reference: "https://example.test/look/123",
  total_price: 750000,
  dp_amount: 250000,
};

function descriptionLines(booking: Booking, serviceName: string | null) {
  return (buildMirrorEvent(booking, serviceName).description ?? "").split("\n");
}

// Seam 1 (pure projection): Booking + service name -> Google event body.
// Catches a title/description/time field that would lie on the owner's phone.
// Misses Google API acceptance and queue behaviour.
describe("buildMirrorEvent", () => {
  it("builds the full event body from every Booking field", () => {
    const event = buildMirrorEvent(BOOKING, "Makeup Wisuda");

    expect(event.summary).toBe("Sinta — Makeup Wisuda");
    expect(event.location).toBe("Gedung Serbaguna, Bandung");
    expect(event.start).toEqual({
      dateTime: "2026-11-01T09:00:00+07:00",
      timeZone: "Asia/Jakarta",
    });
    expect(event.end).toEqual({
      dateTime: "2026-11-01T11:30:00+07:00",
      timeZone: "Asia/Jakarta",
    });
    expect(event.status).toBe("confirmed");
    expect(event.transparency).toBe("opaque");
    expect(event).not.toHaveProperty("attendees");
    expect(event).not.toHaveProperty("reminders");
    expect(event.extendedProperties?.private?.muaBookingId).toBe("b-1");

    const lines = descriptionLines(BOOKING, "Makeup Wisuda");
    expect(lines).toContain("Nama klien: Sinta");
    expect(lines).toContain("No. HP: 081234567890");
    expect(lines).toContain("Layanan: Makeup Wisuda");
    expect(lines).toContain("Jenis acara: Wisuda");
    expect(lines).toContain("Jumlah orang: 2");
    expect(lines).toContain("Lokasi: Gedung Serbaguna, Bandung");
    expect(lines).toContain("Gaya rambut: Hijabdo");
    expect(lines).toContain("Referensi: https://example.test/look/123");
    expect(lines).toContain("Catatan: Datang lebih awal");
    expect(lines).toContain("Total: Rp 750.000");
    expect(lines).toContain("DP: Rp 250.000");
    expect(lines).toContain("ID Booking: b-1");
  });

  it("falls back to the event type, then to Booking, when no service is linked", () => {
    const withEventType = buildMirrorEvent(
      { ...BOOKING, service_id: null },
      null,
    );
    expect(withEventType.summary).toBe("Sinta — Wisuda");

    const withNothing = buildMirrorEvent(
      { ...BOOKING, service_id: null, event_type: "" },
      null,
    );
    expect(withNothing.summary).toBe("Sinta — Booking");
    expect(withNothing.description).not.toMatch(/^Layanan:/m);
    expect(withNothing.description).not.toMatch(/^Jenis acara:/m);
  });

  it("treats whitespace-only service and event type as missing", () => {
    expect(buildMirrorEvent({ ...BOOKING, event_type: "   " }, "  ").summary).toBe(
      "Sinta — Booking",
    );
  });

  it("omits blank optional fields and an unquoted total from the description", () => {
    const sparse = buildMirrorEvent(
      {
        ...BOOKING,
        event_type: "",
        venue: "",
        hairdo: "",
        reference: "",
        notes: "",
        total_price: null,
        dp_amount: 0,
      },
      "",
    );

    expect(sparse.location).toBeUndefined();
    const text = sparse.description ?? "";
    for (const label of [
      "Layanan:",
      "Jenis acara:",
      "Lokasi:",
      "Gaya rambut:",
      "Referensi:",
      "Catatan:",
      "Total:",
    ]) {
      expect(text).not.toContain(label);
    }
    // The compulsory identity and the DP position stay visible.
    expect(text).toContain("Nama klien: Sinta");
    expect(text).toContain("No. HP: 081234567890");
    expect(text).toContain("DP: Rp 0");
    expect(text).toContain("ID Booking: b-1");
  });

  it("keeps a long Reference intact", () => {
    const reference = "x".repeat(300);
    const lines = descriptionLines({ ...BOOKING, reference }, "Makeup");
    expect(lines).toContain(`Referensi: ${reference}`);
  });

  it("never carries Invoice numbers, bank details or other Invoice data", () => {
    const text = buildMirrorEvent(BOOKING, "Makeup").description ?? "";
    expect(text).not.toMatch(/invc-/i);
    expect(text).not.toMatch(/bank/i);
    expect(text).not.toMatch(/rekening/i);
    expect(text).not.toMatch(/invoice/i);
  });

  it("treats an unrecognised legacy Style as plain text rather than losing it", () => {
    const lines = descriptionLines({ ...BOOKING, hairdo: "sanggul klasik" }, "");
    expect(lines).toContain("Gaya rambut: sanggul klasik");
  });
});

// Seam 1 (pure planner): confirmed Bookings + tracked events -> mirror work.
// Catches a backfill that floods history or duplicates an existing event.
// Misses queue draining and Google permissions.
describe("planMirrorWork", () => {
  const booking = (
    id: string,
    date: string,
    status: MirrorPlannerBooking["status"] = "confirmed",
  ): MirrorPlannerBooking => ({ id, date, status });
  const tracked = (bookingId: string): MirrorTrackedRef => ({
    booking_id: bookingId,
    google_event_id: `g-${bookingId}`,
  });
  const today = "2026-10-22";

  it("creates an event for a confirmed today-or-future Booking with no tracked row", () => {
    expect(
      planMirrorWork(
        [booking("today", "2026-10-22"), booking("future", "2026-12-01")],
        [],
        today,
      ),
    ).toEqual([
      { bookingId: "today", action: "create" },
      { bookingId: "future", action: "create" },
    ]);
  });

  it("updates an already-tracked confirmed Booking instead of creating a second event", () => {
    expect(
      planMirrorWork([booking("b1", "2026-11-01")], [tracked("b1")], today),
    ).toEqual([{ bookingId: "b1", action: "update" }]);
  });

  it("leaves past and cancelled Bookings alone when they were never mirrored", () => {
    expect(
      planMirrorWork(
        [
          booking("past", "2026-10-21"),
          booking("cancelled", "2026-11-01", "cancelled"),
          booking("pending", "2026-11-02", "pending"),
        ],
        [],
        today,
      ),
    ).toEqual([]);
  });

  it("deletes an event when a Booking leaves confirmed, but not for past history", () => {
    expect(
      planMirrorWork(
        [
          booking("cancelled", "2026-11-01", "cancelled"),
          booking("pending", "2026-11-02", "pending"),
          booking("past", "2026-10-21", "confirmed"),
        ],
        [tracked("cancelled"), tracked("pending"), tracked("past")],
        today,
      ),
    ).toEqual([
      { bookingId: "cancelled", action: "delete" },
      { bookingId: "pending", action: "delete" },
    ]);
  });

  it("deletes a tracked event whose Booking is gone", () => {
    expect(
      planMirrorWork([booking("b1", "2026-11-01")], [tracked("b1"), tracked("gone")], today),
    ).toEqual([
      { bookingId: "b1", action: "update" },
      { bookingId: "gone", action: "delete" },
    ]);
  });
});

describe("planBackfill", () => {
  const today = "2026-10-22";
  const confirmed = (id: string, date: string): MirrorPlannerBooking => ({
    id,
    date,
    status: "confirmed",
  });

  it("only creates missing events for confirmed Bookings dated today or later", () => {
    const rows = [
      confirmed("past", "2026-10-21"),
      confirmed("today", "2026-10-22"),
      confirmed("future", "2026-11-05"),
    ];
    expect(planBackfill(rows, [], today)).toEqual([
      { bookingId: "today", action: "create" },
      { bookingId: "future", action: "create" },
    ]);
  });

  it("skips already-tracked and non-confirmed Bookings, and orphaned tracked rows", () => {
    const rows = [
      confirmed("tracked", "2026-11-01"),
      { id: "pending", date: "2026-11-02", status: "pending" as const },
    ];
    expect(
      planBackfill(rows, [trackedRef("tracked"), trackedRef("orphan")], today),
    ).toEqual([]);
  });

  it("is idempotent: repeating with the newly tracked rows creates nothing", () => {
    const first = planBackfill([confirmed("b1", "2026-11-01")], [], today);
    expect(first).toEqual([{ bookingId: "b1", action: "create" }]);
    expect(
      planBackfill([confirmed("b1", "2026-11-01")], [trackedRef("b1")], today),
    ).toEqual([]);
  });

  function trackedRef(bookingId: string): MirrorTrackedRef {
    return { booking_id: bookingId, google_event_id: `g-${bookingId}` };
  }
});

describe("mirrorTodayKey", () => {
  it("uses the Asia/Jakarta date, not the server's UTC date", () => {
    // 18:00 UTC is already the next day in WIB.
    expect(mirrorTodayKey(new Date("2026-10-22T18:00:00.000Z"))).toBe(
      "2026-10-23",
    );
    expect(mirrorTodayKey(new Date("2026-10-22T16:59:59.000Z"))).toBe(
      "2026-10-22",
    );
  });
});
