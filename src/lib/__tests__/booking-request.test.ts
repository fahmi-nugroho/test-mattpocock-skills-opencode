import { describe, expect, it } from "vitest";
import {
  mapBookingRequestContext,
  validateBookingRequestPayload,
} from "../booking-request";

// Seam 1 (pure): raw get_booking_request payload -> typed context. Strips
// every key but the four context fields and fails closed on unknown state or
// malformed prefill. Catches PII/price leakage. Misses SQL correctness
// (covered by schema.test.ts).
describe("mapBookingRequestContext", () => {
  it("maps an open request with a prefilled name and slot", () => {
    expect(
      mapBookingRequestContext({
        state: "open",
        client_name: "Sari",
        date: "2026-11-01",
        start_time: "09:00",
        end_time: "12:00",
      }),
    ).toEqual({
      state: "open",
      client_name: "Sari",
      date: "2026-11-01",
      start_time: "09:00",
      end_time: "12:00",
    });
  });

  it("maps an open request with no prefilled context to nulls", () => {
    expect(
      mapBookingRequestContext({
        state: "open",
        client_name: null,
        date: null,
        start_time: null,
        end_time: null,
      }),
    ).toEqual({
      state: "open",
      client_name: null,
      date: null,
      start_time: null,
      end_time: null,
    });
  });

  it("strips extra keys so another client's or the admin's data can never leak", () => {
    // Intentional adversarial case: keep these leaked keys in the fixture.
    expect(
      mapBookingRequestContext({
        state: "open",
        client_name: "Sari",
        date: "2026-11-01",
        start_time: "09:00",
        end_time: "12:00",
        client_phone: "08123456789",
        notes: "private",
        total_price: 500000,
        dp_amount: 100000,
        status: "pending",
        accepted_booking_id: "uuid-1",
        token: "leak",
      }),
    ).toEqual({
      state: "open",
      client_name: "Sari",
      date: "2026-11-01",
      start_time: "09:00",
      end_time: "12:00",
    });
  });

  it("nulls context for submitted/expired/missing even when the payload leaks it", () => {
    for (const state of ["submitted", "expired", "missing"] as const) {
      expect(
        mapBookingRequestContext({
          state,
          client_name: "Sari",
          date: "2026-11-01",
          start_time: "09:00",
          end_time: "12:00",
        }),
      ).toEqual({
        state,
        client_name: null,
        date: null,
        start_time: null,
        end_time: null,
      });
    }
  });

  it("throws on an unknown state (fail closed)", () => {
    expect(() => mapBookingRequestContext({ state: "accepted" })).toThrow(
      /state/i,
    );
  });

  it("throws on non-object input", () => {
    expect(() => mapBookingRequestContext(null)).toThrow();
  });

  it("throws on a malformed open date", () => {
    expect(() =>
      mapBookingRequestContext({
        state: "open",
        client_name: null,
        date: "01-11-2026",
        start_time: "09:00",
        end_time: "12:00",
      }),
    ).toThrow(/date|tanggal/i);
  });

  it("throws on a malformed open time", () => {
    expect(() =>
      mapBookingRequestContext({
        state: "open",
        client_name: null,
        date: "2026-11-01",
        start_time: "9am",
        end_time: "12:00",
      }),
    ).toThrow(/time|jam/i);
  });

  it("throws when a prefill start is not before end", () => {
    expect(() =>
      mapBookingRequestContext({
        state: "open",
        client_name: null,
        date: "2026-11-01",
        start_time: "12:00",
        end_time: "12:00",
      }),
    ).toThrow(/start|mulai/i);
  });
});

const VALID_PAYLOAD = {
  client_name: "Sari",
  client_phone: "08123456789",
  event_type: "Akad",
  headcount: 3,
  venue: "Rumah mempelai",
  hairdo: "Sanggul",
  notes: "datang pagi",
  date: "2026-11-01",
  start_time: "09:00",
  end_time: "12:00",
};

// Seam 1 (pure): fail-closed payload validation with the same rules/caps as
// the SQL submit function. Rejects bad or oversized input before the RPC.
describe("validateBookingRequestPayload", () => {
  it("accepts a full valid payload and returns the trimmed typed shape", () => {
    expect(
      validateBookingRequestPayload({ ...VALID_PAYLOAD, client_name: "  Sari  " }),
    ).toEqual({ ...VALID_PAYLOAD, client_name: "Sari" });
  });

  it("accepts a payload with no requested slot (all three null)", () => {
    const { date, start_time, end_time, ...rest } = VALID_PAYLOAD;
    void date;
    void start_time;
    void end_time;
    expect(validateBookingRequestPayload(rest)).toEqual({
      ...rest,
      date: null,
      start_time: null,
      end_time: null,
    });
  });

  it("strips unknown keys (fails closed on extra keys)", () => {
    expect(
      validateBookingRequestPayload({
        ...VALID_PAYLOAD,
        total_price: 500000,
        dp_amount: 100000,
        status: "confirmed",
        token: "leak",
      }),
    ).toEqual(VALID_PAYLOAD);
  });

  it("rejects non-object input", () => {
    for (const bad of [null, undefined, "Sari", 42, ["Sari"]]) {
      expect(() => validateBookingRequestPayload(bad)).toThrow();
    }
  });

  it("rejects a blank name", () => {
    expect(() =>
      validateBookingRequestPayload({ ...VALID_PAYLOAD, client_name: "   " }),
    ).toThrow(/nama|name/i);
  });

  it("rejects a name longer than 120 chars", () => {
    expect(() =>
      validateBookingRequestPayload({
        ...VALID_PAYLOAD,
        client_name: "a".repeat(121),
      }),
    ).toThrow(/nama|name/i);
  });

  it("rejects a phone with fewer than nine digits", () => {
    expect(() =>
      validateBookingRequestPayload({ ...VALID_PAYLOAD, client_phone: "0812-345" }),
    ).toThrow(/telepon|phone/i);
  });

  it("rejects a phone longer than 32 chars", () => {
    expect(() =>
      validateBookingRequestPayload({
        ...VALID_PAYLOAD,
        client_phone: "0".repeat(33),
      }),
    ).toThrow(/telepon|phone/i);
  });

  it("rejects a headcount below one", () => {
    expect(() =>
      validateBookingRequestPayload({ ...VALID_PAYLOAD, headcount: 0 }),
    ).toThrow(/orang|headcount|jumlah/i);
  });

  it("rejects a headcount above 100", () => {
    expect(() =>
      validateBookingRequestPayload({ ...VALID_PAYLOAD, headcount: 101 }),
    ).toThrow(/orang|headcount|jumlah/i);
  });

  it("rejects a non-integer headcount", () => {
    expect(() =>
      validateBookingRequestPayload({ ...VALID_PAYLOAD, headcount: 2.5 }),
    ).toThrow(/orang|headcount|jumlah/i);
  });

  it("rejects an unparseable date", () => {
    expect(() =>
      validateBookingRequestPayload({ ...VALID_PAYLOAD, date: "01-11-2026" }),
    ).toThrow(/tanggal|date/i);
  });

  it("rejects an unparseable time", () => {
    expect(() =>
      validateBookingRequestPayload({ ...VALID_PAYLOAD, end_time: "12:60" }),
    ).toThrow(/jam|waktu|time/i);
  });

  it("rejects a slot whose start is not before its end", () => {
    expect(() =>
      validateBookingRequestPayload({
        ...VALID_PAYLOAD,
        start_time: "12:00",
        end_time: "12:00",
      }),
    ).toThrow(/mulai|start/i);
  });

  it("accepts a partial slot (each field is optional, absent -> null)", () => {
    const { date, start_time, end_time, ...rest } = VALID_PAYLOAD;
    void date;
    void start_time;
    void end_time;
    expect(
      validateBookingRequestPayload({ ...rest, date: "2026-11-01" }),
    ).toEqual({ ...rest, date: "2026-11-01", start_time: null, end_time: null });
    expect(
      validateBookingRequestPayload({ ...rest, start_time: "09:00" }),
    ).toEqual({ ...rest, date: null, start_time: "09:00", end_time: null });
    expect(
      validateBookingRequestPayload({ ...rest, end_time: "12:00" }),
    ).toEqual({ ...rest, date: null, start_time: null, end_time: "12:00" });
  });

  it("rejects a malformed lone slot field", () => {
    const { date, start_time, end_time, ...rest } = VALID_PAYLOAD;
    void date;
    void start_time;
    void end_time;
    expect(() =>
      validateBookingRequestPayload({ ...rest, date: "01-11-2026" }),
    ).toThrow(/tanggal|date/i);
    expect(() =>
      validateBookingRequestPayload({ ...rest, start_time: "9:00" }),
    ).toThrow(/jam|waktu|time/i);
  });

  it("rejects oversized event_type/venue/hairdo/notes", () => {
    expect(() =>
      validateBookingRequestPayload({ ...VALID_PAYLOAD, event_type: "a".repeat(101) }),
    ).toThrow(/acara|event/i);
    expect(() =>
      validateBookingRequestPayload({ ...VALID_PAYLOAD, venue: "a".repeat(201) }),
    ).toThrow(/lokasi|venue|tempat/i);
    expect(() =>
      validateBookingRequestPayload({ ...VALID_PAYLOAD, hairdo: "a".repeat(101) }),
    ).toThrow(/rambut|hairdo/i);
    expect(() =>
      validateBookingRequestPayload({ ...VALID_PAYLOAD, notes: "a".repeat(1001) }),
    ).toThrow(/catatan|notes/i);
  });
});
