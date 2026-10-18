import { describe, expect, it } from "vitest";
import { validateBookingInput } from "../admin/validate-booking";

// Seam 1 (pure): booking form validation with known-good literals.
// Catches bad date/time/client/status before a DB write.
// Misses live DB CHECKs and overlap guard (booking-conflicts seam).
describe("validateBookingInput", () => {
  it("accepts a valid booking", () => {
    expect(
      validateBookingInput({
        date: "2026-10-12",
        start_time: "09:00",
        end_time: "11:00",
        service_id: null,
        client_name: "Sinta",
        client_phone: "081234567890",
        notes: "Rias wisuda",
        status: "pending",
      }),
    ).toEqual({
      date: "2026-10-12",
      start_time: "09:00",
      end_time: "11:00",
      service_id: null,
      client_name: "Sinta",
      client_phone: "081234567890",
      notes: "Rias wisuda",
      status: "pending",
      event_type: "",
      headcount: 1,
      venue: "",
      hairdo: "",
      total_price: null,
      dp_amount: 0,
    });
  });

  it("carries the new booking fields through, trimmed", () => {
    expect(
      validateBookingInput({
        date: "2026-10-12",
        start_time: "09:00",
        end_time: "11:00",
        client_name: "Sinta",
        client_phone: "081234567890",
        status: "pending",
        event_type: "  Wisuda  ",
        headcount: 3,
        venue: " Gedung A ",
        hairdo: " Sanggul ",
        total_price: 450000,
        dp_amount: 100000,
      }),
    ).toMatchObject({
      event_type: "Wisuda",
      headcount: 3,
      venue: "Gedung A",
      hairdo: "Sanggul",
      total_price: 450000,
      dp_amount: 100000,
    });
  });

  it("trims names/notes and defaults missing notes to empty", () => {
    expect(
      validateBookingInput({
        date: "2026-10-12",
        start_time: "09:00",
        end_time: "10:00",
        client_name: "  Sinta  ",
        client_phone: "081234567890",
        status: "confirmed",
      }),
    ).toMatchObject({ client_name: "Sinta", notes: "" });
  });

  it("rejects a malformed date instead of writing an unschedulable row", () => {
    expect(() =>
      validateBookingInput({
        date: "12-10-2026",
        start_time: "09:00",
        end_time: "10:00",
        client_name: "Sinta",
        client_phone: "081234567890",
        status: "pending",
      }),
    ).toThrow(/tanggal|date/i);
  });

  it("rejects end before start instead of breaking doesOverlap", () => {
    expect(() =>
      validateBookingInput({
        date: "2026-10-12",
        start_time: "11:00",
        end_time: "10:00",
        client_name: "Sinta",
        client_phone: "081234567890",
        status: "pending",
      }),
    ).toThrow(/jam|waktu|time/i);
  });

  it("rejects a blank client name instead of saving PII-less rows", () => {
    expect(() =>
      validateBookingInput({
        date: "2026-10-12",
        start_time: "09:00",
        end_time: "10:00",
        client_name: "   ",
        client_phone: "081234567890",
        status: "pending",
      }),
    ).toThrow(/nama|name|klien/i);
  });

  it("rejects a too-short phone instead of losing the WA contact", () => {
    expect(() =>
      validateBookingInput({
        date: "2026-10-12",
        start_time: "09:00",
        end_time: "10:00",
        client_name: "Sinta",
        client_phone: "123",
        status: "pending",
      }),
    ).toThrow(/telepon|phone|WA/i);
  });

  it("rejects an unknown status instead of leaking it to the RPC", () => {
    expect(() =>
      validateBookingInput({
        date: "2026-10-12",
        start_time: "09:00",
        end_time: "10:00",
        client_name: "Sinta",
        client_phone: "081234567890",
        status: "waiting",
      }),
    ).toThrow(/status/i);
  });

  it("rejects a headcount below one instead of an empty job", () => {
    expect(() =>
      validateBookingInput({
        date: "2026-10-12",
        start_time: "09:00",
        end_time: "10:00",
        client_name: "Sinta",
        client_phone: "081234567890",
        status: "pending",
        headcount: 0,
      }),
    ).toThrow(/jumlah|orang|headcount/i);
  });

  it("rejects a fractional headcount instead of a partial person", () => {
    expect(() =>
      validateBookingInput({
        date: "2026-10-12",
        start_time: "09:00",
        end_time: "10:00",
        client_name: "Sinta",
        client_phone: "081234567890",
        status: "pending",
        headcount: 1.5,
      }),
    ).toThrow(/jumlah|orang|headcount/i);
  });

  it("rejects a negative total and a negative DP", () => {
    expect(() =>
      validateBookingInput({
        date: "2026-10-12",
        start_time: "09:00",
        end_time: "10:00",
        client_name: "Sinta",
        client_phone: "081234567890",
        status: "pending",
        total_price: -1,
      }),
    ).toThrow(/total|harga/i);
    expect(() =>
      validateBookingInput({
        date: "2026-10-12",
        start_time: "09:00",
        end_time: "10:00",
        client_name: "Sinta",
        client_phone: "081234567890",
        status: "pending",
        dp_amount: -1,
      }),
    ).toThrow(/dp|down/i);
  });

  it("rejects over-long event type / venue / hairdo instead of truncating silently", () => {
    const base = {
      date: "2026-10-12",
      start_time: "09:00",
      end_time: "10:00",
      client_name: "Sinta",
      client_phone: "081234567890",
      status: "pending" as const,
    };
    expect(() =>
      validateBookingInput({ ...base, event_type: "x".repeat(101) }),
    ).toThrow(/jenis|acara/i);
    expect(() =>
      validateBookingInput({ ...base, venue: "x".repeat(201) }),
    ).toThrow(/lokasi|venue|tempat/i);
    expect(() =>
      validateBookingInput({ ...base, hairdo: "x".repeat(101) }),
    ).toThrow(/rambut|hairdo/i);
  });

  it("clears total_price to null when empty", () => {
    expect(
      validateBookingInput({
        date: "2026-10-12",
        start_time: "09:00",
        end_time: "10:00",
        client_name: "Sinta",
        client_phone: "081234567890",
        status: "pending",
        total_price: null,
      }).total_price,
    ).toBeNull();
  });
});
