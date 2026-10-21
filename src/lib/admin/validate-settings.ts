import { normaliseInstagramHandle } from "../instagram";

export interface SettingsInput {
  wa_number: string;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  instagram_handle?: string;
}

/** The settings row's printable values, all present after validation. */
export interface ValidatedSettingsInput {
  wa_number: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  instagram_handle: string;
}

/**
 * Validate the admin settings form (ticket 07). The WhatsApp number keeps its
 * hours-removal rules unchanged: digits only, at least 10 of them, with the
 * same refusal message. The other four printables are optional for the admin:
 * empty stays empty and the Invoice prints an em dash. The Instagram handle
 * loses any leading `@` and surrounding blanks, and the account number is
 * reduced to digits so what the admin types prints as stored.
 */
export function validateSettingsInput(
  input: SettingsInput,
): ValidatedSettingsInput {
  const wa_number = input.wa_number.replace(/\D/g, "");
  if (wa_number.length < 10) {
    throw new Error("Nomor WA tidak valid (minimal 10 digit angka)");
  }
  return {
    wa_number,
    bank_name: (input.bank_name ?? "").trim(),
    account_name: (input.account_name ?? "").trim(),
    account_number: (input.account_number ?? "").replace(/\D/g, ""),
    instagram_handle: normaliseInstagramHandle(input.instagram_handle ?? ""),
  };
}
