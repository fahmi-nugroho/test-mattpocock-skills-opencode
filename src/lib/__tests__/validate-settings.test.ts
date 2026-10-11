import { describe, expect, it } from "vitest";
import { validateSettingsInput } from "../admin/validate-settings";

// Seam 1 (pure): settings form validation with known-good literals.
// Catches bad WA/hours before a DB write. Misses live DB CHECKs.
describe("validateSettingsInput", () => {
  it("accepts a valid WA number and operating window", () => {
    expect(
      validateSettingsInput({
        wa_number: "6281234567890",
        open_hour: "09:00",
        close_hour: "19:00",
      }),
    ).toEqual({
      wa_number: "6281234567890",
      open_hour: "09:00",
      close_hour: "19:00",
    });
  });

  it("normalises formatted WA numbers to digits only", () => {
    expect(
      validateSettingsInput({
        wa_number: "+62 812-3456-7890",
        open_hour: "09:00",
        close_hour: "19:00",
      }),
    ).toEqual({
      wa_number: "6281234567890",
      open_hour: "09:00",
      close_hour: "19:00",
    });
  });

  it("rejects a blank WA number instead of saving a broken contact link", () => {
    expect(() =>
      validateSettingsInput({
        wa_number: "   ",
        open_hour: "09:00",
        close_hour: "19:00",
      }),
    ).toThrow(/wa/i);
  });

  it("rejects a too-short WA number", () => {
    expect(() =>
      validateSettingsInput({
        wa_number: "62812",
        open_hour: "09:00",
        close_hour: "19:00",
      }),
    ).toThrow(/wa/i);
  });

  it("rejects invalid HH:MM hours instead of breaking calendar derivation", () => {
    expect(() =>
      validateSettingsInput({
        wa_number: "6281234567890",
        open_hour: "9am",
        close_hour: "19:00",
      }),
    ).toThrow(/jam|HH:MM/i);
    expect(() =>
      validateSettingsInput({
        wa_number: "6281234567890",
        open_hour: "09:00",
        close_hour: "25:00",
      }),
    ).toThrow(/jam|HH:MM/i);
  });

  it("rejects a window where open is not before close", () => {
    expect(() =>
      validateSettingsInput({
        wa_number: "6281234567890",
        open_hour: "19:00",
        close_hour: "09:00",
      }),
    ).toThrow(/buka.*tutup|sebelum/i);
    expect(() =>
      validateSettingsInput({
        wa_number: "6281234567890",
        open_hour: "09:00",
        close_hour: "09:00",
      }),
    ).toThrow(/buka.*tutup|sebelum/i);
  });
});
