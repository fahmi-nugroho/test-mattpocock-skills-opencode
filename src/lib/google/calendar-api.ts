import { createPrivateKey, sign } from "node:crypto";
import type { GoogleCalendarConfig } from "./config";
import type { GoogleCalendarEventDraft, GoogleCalendarPort } from "./port";

/**
 * Real Google Calendar port for the service-account mirror (ticket 01).
 *
 * The browser never imports this file: it lives behind a Node-runtime admin
 * route so no Google credential can reach the client. A short-lived access
 * token is minted by signing a JWT with the service-account key; there is no
 * OAuth consent screen and no refresh token to expire.
 */

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_ROOT = "https://www.googleapis.com/calendar/v3";

export class GoogleCalendarApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GoogleCalendarApiError";
  }
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function createAssertion(
  config: GoogleCalendarConfig,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: config.serviceAccountEmail,
      scope: CALENDAR_SCOPE,
      aud: TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signature = sign(
    "RSA-SHA256",
    Buffer.from(unsigned),
    createPrivateKey(config.privateKey),
  );
  return `${unsigned}.${base64url(signature)}`;
}

async function responseMessage(
  response: Response,
  action: "read" | "create" | "delete",
): Promise<string> {
  const status = response.status;
  if (action === "read") {
    if (status === 404) {
      return "Kalender Google Calendar tidak ditemukan. Periksa GOOGLE_CALENDAR_ID dan bagikan kalender ke akun layanan.";
    }
    if (status === 403) {
      return "Kalender Google Calendar tidak dapat dibaca. Bagikan kalender ke akun layanan.";
    }
    return `Google Calendar gagal membaca kalender (status ${status}).`;
  }
  if (action === "create") {
    if (status === 403) {
      return "Akun layanan tidak memiliki izin menulis ke kalender Google. Bagikan kalender dengan akses 'Make changes to events'.";
    }
    return `Google Calendar gagal membuat event (status ${status}).`;
  }
  if (status === 403) {
    return "Akun layanan tidak memiliki izin menghapus event di kalender Google.";
  }
  return `Google Calendar gagal menghapus event (status ${status}).`;
}

export function createGoogleCalendarPort(
  config: GoogleCalendarConfig,
  fetchImpl: typeof fetch = fetch,
): GoogleCalendarPort {
  let cachedToken: { value: string; expiresAt: number } | null = null;

  async function accessToken(nowMs: number): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > nowMs) return cachedToken.value;

    const response = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: createAssertion(config),
      }),
    });
    if (!response.ok) {
      throw new GoogleCalendarApiError(
        "Google Calendar menolak kredensial akun layanan. Periksa email dan kunci privat.",
        response.status,
      );
    }
    const body = (await response.json()) as {
      access_token?: unknown;
      expires_in?: unknown;
    };
    if (typeof body.access_token !== "string" || body.access_token === "") {
      throw new GoogleCalendarApiError(
        "Google Calendar tidak mengembalikan token akses.",
        response.status,
      );
    }
    const lifetime =
      typeof body.expires_in === "number" ? Math.max(60, body.expires_in - 60) : 3540;
    cachedToken = {
      value: body.access_token,
      expiresAt: nowMs + lifetime * 1000,
    };
    return cachedToken.value;
  }

  async function request(
    path: string,
    init: RequestInit,
    action: "read" | "create" | "delete",
  ): Promise<Response> {
    const token = await accessToken(Date.now());
    const response = await fetchImpl(`${API_ROOT}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    if (!response.ok) {
      throw new GoogleCalendarApiError(
        await responseMessage(response, action),
        response.status,
      );
    }
    return response;
  }

  const calendarPath = (calendarId: string) =>
    `/calendars/${encodeURIComponent(calendarId)}`;

  return {
    async readCalendar(calendarId) {
      await request(calendarPath(calendarId), { method: "GET" }, "read");
    },

    async createEvent(calendarId, event: GoogleCalendarEventDraft) {
      const response = await request(
        `${calendarPath(calendarId)}/events`,
        { method: "POST", body: JSON.stringify(event) },
        "create",
      );
      const body = (await response.json()) as { id?: unknown };
      if (typeof body.id !== "string" || body.id === "") {
        throw new GoogleCalendarApiError(
          "Google Calendar tidak mengembalikan id event.",
          response.status,
        );
      }
      return { id: body.id };
    },

    async deleteEvent(calendarId, eventId) {
      await request(
        `${calendarPath(calendarId)}/events/${encodeURIComponent(eventId)}`,
        { method: "DELETE" },
        "delete",
      );
    },
  };
}
