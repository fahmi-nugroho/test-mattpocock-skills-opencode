import { describe, expect, it } from "vitest";
import { validateBlockInput } from "../admin/validate-block";

// Seam 1 (pure): block form validation with known-good literals.
// Catches all-day vs time-range misuse before a DB write.
// Misses live DB CHECKs and confirmed-booking conflicts.
describe("validateBlockInput", () => {
  it("accepts an all-day block without times", () => {
    expect(
      validateBlockInput({
        date: "2026-10-12",
        all_day: true,
        reason: "Libur",
      }),
    ).toEqual({
      date: "2026-10-12",
      all_day: true,
      start_time: null,
      end_time: null,
      reason: "Libur",
    });
  });

  it("accepts a time-range block", () => {
    expect(
      validateBlockInput({
        date: "2026-10-12",
        all_day: false,
        start_time: "12:00",
        end_time: "14:00",
        reason: "Acara keluarga",
      }),
    ).toEqual({
      date: "2026-10-12",
      all_day: false,
      start_time: "12:00",
      end_time: "14:00",
      reason: "Acara keluarga",
    });
  });

  it("defaults a missing reason to empty", () => {
    expect(
      validateBlockInput({
        date: "2026-10-12",
        all_day: true,
      }),
    ).toMatchObject({ reason: "" });
  });

  it("rejects times on an all-day block instead of bypassing the SQL CHECK", () => {
    expect(() =>
      validateBlockInput({
        date: "2026-10-12",
        all_day: true,
        start_time: "09:00",
        end_time: "10:00",
      }),
    ).toThrow(/sehari|all-day/i);
  });

  it("rejects a time-range block without times", () => {
    expect(() =>
      validateBlockInput({
        date: "2026-10-12",
        all_day: false,
      }),
    ).toThrow(/jam|waktu|time/i);
  });

  it("rejects end before start", () => {
    expect(() =>
      validateBlockInput({
        date: "2026-10-12",
        all_day: false,
        start_time: "14:00",
        end_time: "12:00",
      }),
    ).toThrow(/jam|waktu|time/i);
  });

  it("rejects a malformed date", () => {
    expect(() =>
      validateBlockInput({ date: "tomorrow", all_day: true }),
    ).toThrow(/tanggal|date/i);
  });
});
