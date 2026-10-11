export interface SettingsInput {
  wa_number: string;
  open_hour: string;
  close_hour: string;
}

const HHMM_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * Validate the admin operating-settings form (ticket 05).
 * Normalises wa_number to digits only (same rule as buildWaLink, so
 * stored "+62 812-..." formats still produce a working wa.me link) and
 * enforces the 00-23 HH:MM + open < close window that the SQL CHECKs
 * (0001_schema.sql) and calendar derivation rely on.
 */
export function validateSettingsInput(input: SettingsInput): SettingsInput {
  const wa_number = input.wa_number.replace(/\D/g, "");
  if (wa_number.length < 10) {
    throw new Error("Nomor WA tidak valid (minimal 10 digit angka)");
  }
  if (!HHMM_RE.test(input.open_hour) || !HHMM_RE.test(input.close_hour)) {
    throw new Error("Jam operasional harus format HH:MM (00:00–23:59)");
  }
  if (!(input.open_hour < input.close_hour)) {
    throw new Error("Jam buka harus sebelum jam tutup");
  }
  return { wa_number, open_hour: input.open_hour, close_hour: input.close_hour };
}
