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
});
