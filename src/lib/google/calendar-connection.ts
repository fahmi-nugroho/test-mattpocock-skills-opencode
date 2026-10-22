import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, GoogleCalendarConnection } from "../supabase/database";
import { GOOGLE_CONFIG_ERROR, type GoogleCalendarConfig } from "./config";
import { isMirrorUnhealthy } from "./connection-status";
import type { GoogleCalendarPort } from "./port";

export { isMirrorUnhealthy };

type TypedClient = SupabaseClient<Database>;

/** A live config + port, or a throw when the server env is incomplete. */
export type MirrorRuntimeFactory = () => {
  config: GoogleCalendarConfig;
  port: GoogleCalendarPort;
};

export interface ConnectionTestResult {
  ok: boolean;
  /** Concrete Indonesian failure message; null on success. */
  error: string | null;
}

export const MIRROR_DISABLED_ERROR =
  "Kalender Google belum terhubung. Hubungkan dulu di Pengaturan.";

const CONNECTION_TABLE = "google_calendar_connection";
const PROBE_SUMMARY = "MUA — Tes koneksi (dapat dihapus)";

/**
 * One connection, one master switch (ticket 01). The settings UI reads these
 * values; every mirror job calls `ensureMirrorEnabled` first, so disconnecting
 * refuses further work without touching events already in Google.
 */
export async function getConnection(
  client: TypedClient,
): Promise<GoogleCalendarConnection> {
  const loose = client as unknown as {
    from(table: string): {
      select(cols: string): {
        eq(
          col: string,
          value: number,
        ): {
          single(): Promise<{
            data: unknown;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  const { data, error } = await loose
    .from(CONNECTION_TABLE)
    .select("*")
    .eq("id", 1)
    .single();
  if (error) {
    throw new Error(`Gagal memuat status Kalender Google: ${error.message}`);
  }
  if (data === null || typeof data !== "object") {
    throw new Error("Status Kalender Google belum tersedia.");
  }
  return data as GoogleCalendarConnection;
}

async function updateConnection(
  client: TypedClient,
  patch: Record<string, unknown>,
): Promise<void> {
  const loose = client as unknown as {
    from(table: string): {
      update(values: Record<string, unknown>): {
        eq(
          col: string,
          value: number,
        ): Promise<{ error: { message: string } | null }>;
      };
    };
  };
  const { error } = await loose
    .from(CONNECTION_TABLE)
    .update(patch)
    .eq("id", 1);
  if (error) {
    throw new Error(`Gagal menyimpan status Kalender Google: ${error.message}`);
  }
}

/** The guard every future mirror job calls before writing anything. */
export function ensureMirrorEnabled(
  connection: Pick<GoogleCalendarConnection, "enabled">,
): void {
  if (!connection.enabled) throw new Error(MIRROR_DISABLED_ERROR);
}

/** Read the connection and refuse to continue while it is disconnected. */
export async function getEnabledConnection(
  client: TypedClient,
): Promise<GoogleCalendarConnection> {
  const connection = await getConnection(client);
  ensureMirrorEnabled(connection);
  return connection;
}

function errorText(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return fallback;
}

/**
 * Cheap write access check: read the target calendar, then create and delete
 * a clearly labelled probe event. A read-only share fails at the create step,
 * so the admin sees a concrete reason instead of a silent mirror later.
 */
export async function probeCalendarAccess(
  port: GoogleCalendarPort,
  calendarId: string,
  now: Date = new Date(),
): Promise<void> {
  await port.readCalendar(calendarId);
  const start = new Date(now.getTime() + 15 * 60_000);
  const end = new Date(start.getTime() + 15 * 60_000);
  const probe = await port.createEvent(calendarId, {
    summary: PROBE_SUMMARY,
    description:
      "Event uji dari website MUA. Dibuat lalu dihapus otomatis saat Tes koneksi.",
    start: { dateTime: start.toISOString(), timeZone: "Asia/Jakarta" },
    end: { dateTime: end.toISOString(), timeZone: "Asia/Jakarta" },
    status: "confirmed",
    transparency: "opaque",
  });
  try {
    await port.deleteEvent(calendarId, probe.id);
  } catch (error) {
    throw new Error(
      `Event uji berhasil dibuat tetapi gagal dihapus: ${errorText(
        error,
        "Kesalahan tidak diketahui.",
      )} Hapus event "${PROBE_SUMMARY}" secara manual jika masih ada.`,
    );
  }
}

async function recordFailure(
  client: TypedClient,
  message: string,
  now: Date,
): Promise<ConnectionTestResult> {
  await updateConnection(client, {
    last_error: message,
    updated_at: now.toISOString(),
  });
  return { ok: false, error: message };
}

async function runAccessCheck(
  client: TypedClient,
  makeRuntime: MirrorRuntimeFactory,
  now: Date,
  enable: boolean,
): Promise<ConnectionTestResult> {
  let runtime: ReturnType<MirrorRuntimeFactory>;
  try {
    runtime = makeRuntime();
  } catch (error) {
    return recordFailure(client, errorText(error, GOOGLE_CONFIG_ERROR), now);
  }

  try {
    await probeCalendarAccess(runtime.port, runtime.config.calendarId, now);
  } catch (error) {
    return recordFailure(
      client,
      errorText(error, "Tes koneksi Google Calendar gagal."),
      now,
    );
  }

  await updateConnection(client, {
    calendar_id: runtime.config.calendarId,
    last_verified_at: now.toISOString(),
    last_error: "",
    updated_at: now.toISOString(),
    ...(enable ? { enabled: true } : {}),
  });
  return { ok: true, error: null };
}

/** "Tes koneksi": verify access and record the outcome without enabling. */
export async function testCalendarConnection(
  client: TypedClient,
  makeRuntime: MirrorRuntimeFactory,
  now: Date = new Date(),
): Promise<ConnectionTestResult> {
  return runAccessCheck(client, makeRuntime, now, false);
}

/** "Hubungkan": enable only after the same access check succeeds. */
export async function connectCalendar(
  client: TypedClient,
  makeRuntime: MirrorRuntimeFactory,
  now: Date = new Date(),
): Promise<ConnectionTestResult> {
  return runAccessCheck(client, makeRuntime, now, true);
}

/**
 * "Putuskan": turn the mirror off immediately. Deliberately makes no Google
 * call, so every event already mirrored stays exactly where it is.
 */
export async function disconnectCalendar(
  client: TypedClient,
  now: Date = new Date(),
): Promise<void> {
  await updateConnection(client, {
    enabled: false,
    updated_at: now.toISOString(),
  });
}
