export interface SettingsInput {
  wa_number: string;
}

/**
 * Validate the admin WA-only settings form (hours-removal contract).
 * Normalises wa_number to digits only (same rule as buildWaLink, so
 * stored "+62 812-..." formats still produce a working wa.me link).
 * Operating-hours validation was removed with the window: stray
 * open_hour/close_hour keys are ignored, never persisted.
 */
export function validateSettingsInput(input: SettingsInput): SettingsInput {
  const wa_number = input.wa_number.replace(/\D/g, "");
  if (wa_number.length < 10) {
    throw new Error("Nomor WA tidak valid (minimal 10 digit angka)");
  }
  return { wa_number };
}
