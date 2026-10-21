import { describe, expect, it } from "vitest";
import { validateSettingsInput } from "../admin/validate-settings";

// Seam 1 (pure): the settings form validation with known-good literals.
// Catches bad WA before a DB write and payment details that reach the Invoice
// picture with formatting the admin did not mean to save. Misses live DB
// CHECKs. The WA rules are unchanged from the hours-removal contract.
const EMPTY_PAYMENT = {
  bank_name: "",
  account_name: "",
  account_number: "",
  instagram_handle: "",
};

describe("validateSettingsInput", () => {
  it("accepts a valid WA number", () => {
    expect(
      validateSettingsInput({
        wa_number: "6281234567890",
        ...EMPTY_PAYMENT,
      }),
    ).toEqual({ wa_number: "6281234567890", ...EMPTY_PAYMENT });
  });

  it("normalises formatted WA numbers to digits only", () => {
    expect(
      validateSettingsInput({
        wa_number: "+62 812-3456-7890",
        ...EMPTY_PAYMENT,
      }),
    ).toEqual({ wa_number: "6281234567890", ...EMPTY_PAYMENT });
  });

  it("rejects a blank WA number instead of saving a broken contact link", () => {
    expect(() =>
      validateSettingsInput({ wa_number: "   ", ...EMPTY_PAYMENT }),
    ).toThrow("Nomor WA tidak valid (minimal 10 digit angka)");
  });

  it("rejects a too-short WA number", () => {
    expect(() =>
      validateSettingsInput({ wa_number: "62812", ...EMPTY_PAYMENT }),
    ).toThrow("Nomor WA tidak valid (minimal 10 digit angka)");
  });

  it("carries the four payment fields with the WA number", () => {
    expect(
      validateSettingsInput({
        wa_number: "6281234567890",
        bank_name: "BCA",
        account_name: "Wandana",
        account_number: "1234567890",
        instagram_handle: "wandanamakeup",
      }),
    ).toEqual({
      wa_number: "6281234567890",
      bank_name: "BCA",
      account_name: "Wandana",
      account_number: "1234567890",
      instagram_handle: "wandanamakeup",
    });
  });

  it("saves the Instagram handle without a leading @", () => {
    expect(
      validateSettingsInput({
        wa_number: "6281234567890",
        ...EMPTY_PAYMENT,
        instagram_handle: "  @wandanamakeup ",
      }).instagram_handle,
    ).toBe("wandanamakeup");
  });

  it("reduces the account number to digits", () => {
    expect(
      validateSettingsInput({
        wa_number: "6281234567890",
        ...EMPTY_PAYMENT,
        account_number: "123-456 7890",
      }).account_number,
    ).toBe("1234567890");
  });

  it("accepts empty payment details instead of blocking the rest", () => {
    expect(
      validateSettingsInput({
        wa_number: "6281234567890",
        ...EMPTY_PAYMENT,
      }),
    ).toEqual({ wa_number: "6281234567890", ...EMPTY_PAYMENT });
  });

  it("ignores stray hours keys instead of persisting them", () => {
    expect(
      validateSettingsInput({
        wa_number: "6281234567890",
        ...EMPTY_PAYMENT,
        open_hour: "09:00",
        close_hour: "19:00",
      } as unknown as {
        wa_number: string;
        bank_name: string;
        account_name: string;
        account_number: string;
        instagram_handle: string;
      }),
    ).toEqual({ wa_number: "6281234567890", ...EMPTY_PAYMENT });
  });
});
