import { createPrivateKey } from "node:crypto";

/**
 * Server-only Google Calendar configuration (ticket 01).
 *
 * The mirror authenticates as a service account whose address has been given
 * "Make changes to events" on the dedicated "MUA — Booking" calendar. These
 * values must never reach the browser, so no `NEXT_PUBLIC_` fallback exists.
 * The private key arrives from the environment with escaped newlines; it is
 * normalised before use and validated here so a bad key becomes a plain
 * Indonesian configuration error instead of an unhandled OpenSSL exception.
 */

export const GOOGLE_CONFIG_ERROR =
  "Konfigurasi Google Calendar belum lengkap. Isi GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, dan GOOGLE_CALENDAR_ID di server.";

export const GOOGLE_PRIVATE_KEY_ERROR =
  "Kunci privat akun layanan Google Calendar tidak valid. Periksa GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.";

export interface GoogleCalendarConfig {
  serviceAccountEmail: string;
  /** PEM key with real newlines, ready for the JWT signature. */
  privateKey: string;
  calendarId: string;
}

export class GoogleCalendarConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleCalendarConfigError";
  }
}

/** Turn the env file's literal `\n` sequences into real PEM line breaks. */
export function normalisePrivateKey(raw: string): string {
  return raw.replace(/\\n/g, "\n").trim();
}

export function loadGoogleCalendarConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): GoogleCalendarConfig {
  const serviceAccountEmail = (env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "").trim();
  const rawPrivateKey = (env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "").trim();
  const calendarId = (env.GOOGLE_CALENDAR_ID ?? "").trim();

  if (!serviceAccountEmail || !rawPrivateKey || !calendarId) {
    throw new GoogleCalendarConfigError(GOOGLE_CONFIG_ERROR);
  }

  const privateKey = normalisePrivateKey(rawPrivateKey);
  if (
    !privateKey.includes("BEGIN PRIVATE KEY") ||
    !privateKey.includes("END PRIVATE KEY")
  ) {
    throw new GoogleCalendarConfigError(GOOGLE_PRIVATE_KEY_ERROR);
  }

  try {
    createPrivateKey(privateKey);
  } catch {
    throw new GoogleCalendarConfigError(GOOGLE_PRIVATE_KEY_ERROR);
  }

  return { serviceAccountEmail, privateKey, calendarId };
}
