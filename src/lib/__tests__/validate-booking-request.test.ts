import { describe, expect, it } from "vitest";
import { validateRequestSlot } from "../admin/validate-booking-request";

// Seam 1 (pure): the requested slot shared by the admin create form and the
// public submit payload validator. Per-field optional (date/start/end each
// nullable), so it catches an all-or-nothing regression and a missing
// start < end check when both times are present. Misses live DB/RLS behavior.
describe("validateRequestSlot", () => {
  it("accepts a full slot and returns it unchanged", () => {
    expect(
      validateRequestSlot({
        date: "2026-11-01",
        start_time: "09:00",
        end_time: "12:00",
      }),
    ).toEqual({ date: "2026-11-01", start_time: "09:00", end_time: "12:00" });
  });

  it("accepts each field alone, leaving the others null", () => {
    expect(validateRequestSlot({ date: "2026-11-01" })).toEqual({
      date: "2026-11-01",
      start_time: null,
      end_time: null,
    });
    expect(validateRequestSlot({ start_time: "09:00" })).toEqual({
      date: null,
      start_time: "09:00",
      end_time: null,
    });
    expect(validateRequestSlot({ end_time: "12:00" })).toEqual({
      date: null,
      start_time: null,
      end_time: "12:00",
    });
  });

  it("accepts a lone time without an order check", () => {
    expect(validateRequestSlot({ start_time: "23:00" })).toEqual({
      date: null,
      start_time: "23:00",
      end_time: null,
    });
  });

  it("normalizes empty/null/undefined to null", () => {
    expect(
      validateRequestSlot({ date: "", start_time: null, end_time: undefined }),
    ).toEqual({ date: null, start_time: null, end_time: null });
    expect(validateRequestSlot({})).toEqual({
      date: null,
      start_time: null,
      end_time: null,
    });
  });

  it("rejects a malformed date, naming the field", () => {
    expect(() => validateRequestSlot({ date: "01-11-2026" })).toThrow(
      /tanggal/i,
    );
  });

  it("rejects a malformed start or end time, naming the field", () => {
    expect(() => validateRequestSlot({ start_time: "9:00" })).toThrow(/jam/i);
    expect(() => validateRequestSlot({ end_time: "12:60" })).toThrow(/jam/i);
  });

  it("rejects start >= end only when both times are present", () => {
    expect(() =>
      validateRequestSlot({ start_time: "12:00", end_time: "12:00" }),
    ).toThrow(/jam mulai/i);
    expect(() =>
      validateRequestSlot({ start_time: "13:00", end_time: "09:00" }),
    ).toThrow(/jam mulai/i);
  });
});
