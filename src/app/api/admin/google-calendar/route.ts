import { NextResponse } from "next/server";
import { createGoogleCalendarPort } from "@/lib/google/calendar-api";
import {
  connectCalendar,
  disconnectCalendar,
  getConnection,
  testCalendarConnection,
  MIRROR_DISABLED_ERROR,
  type MirrorRuntimeFactory,
} from "@/lib/google/calendar-connection";
import {
  GOOGLE_CONFIG_ERROR,
  GoogleCalendarConfigError,
  loadGoogleCalendarConfig,
  type GoogleCalendarConfig,
} from "@/lib/google/config";
import type { GoogleCalendarStatus } from "@/lib/google/connection-status";
import { drainMirrorQueue } from "@/lib/google/mirror";
import { requireAdminClient } from "@/lib/supabase/server";

// node:crypto signs the service-account JWT, so this route must stay on the
// Node runtime. Every action verifies the admin's Supabase access token first;
// the browser never receives a Google credential.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConfigResult =
  | { ok: true; config: GoogleCalendarConfig }
  | { ok: false; error: string };

function readConfig(): ConfigResult {
  try {
    return { ok: true, config: loadGoogleCalendarConfig() };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.message.trim() !== ""
          ? error.message
          : GOOGLE_CONFIG_ERROR,
    };
  }
}

function runtimeFactory(configResult: ConfigResult): MirrorRuntimeFactory {
  return () => {
    if (!configResult.ok) {
      throw new GoogleCalendarConfigError(configResult.error);
    }
    const { config } = configResult;
    return { config, port: createGoogleCalendarPort(config) };
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim() !== ""
    ? error.message
    : "Terjadi kesalahan yang tidak diketahui.";
}

function unauthorized() {
  return NextResponse.json(
    { error: "Sesi admin tidak valid. Masuk kembali." },
    { status: 401 },
  );
}

export async function GET(request: Request) {
  const client = await requireAdminClient(request);
  if (!client) return unauthorized();

  try {
    const connection = await getConnection(client);
    const config = readConfig();
    const status: GoogleCalendarStatus = config.ok
      ? { configured: true, configError: null, connection }
      : { configured: false, configError: config.error, connection };
    return NextResponse.json({ status });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const client = await requireAdminClient(request);
  if (!client) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
  } | null;
  const action = body?.action;

  try {
    if (action === "disconnect") {
      await disconnectCalendar(client);
      return NextResponse.json({ ok: true, error: null });
    }

    const makeRuntime = runtimeFactory(readConfig());

    if (action === "drain") {
      try {
        const result = await drainMirrorQueue(client, makeRuntime);
        return NextResponse.json(result);
      } catch (error) {
        if (errorMessage(error) === MIRROR_DISABLED_ERROR) {
          return NextResponse.json(
            { ok: false, error: MIRROR_DISABLED_ERROR },
            { status: 409 },
          );
        }
        throw error;
      }
    }

    if (action !== "test" && action !== "connect") {
      return NextResponse.json(
        { error: "Aksi Kalender Google tidak dikenal." },
        { status: 400 },
      );
    }

    const result =
      action === "test"
        ? await testCalendarConnection(client, makeRuntime)
        : await connectCalendar(client, makeRuntime);

    // Connecting starts the mirror: the first successful drain backfills every
    // confirmed Booking from today forward. A failure here leaves the queue
    // open for the next drain and must not turn a successful connect into an
    // error, so it is best effort and its outcome is returned alongside.
    if (action === "connect" && result.ok) {
      try {
        const mirror = await drainMirrorQueue(client, makeRuntime);
        return NextResponse.json({ ...result, mirror });
      } catch {
        return NextResponse.json(result);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}
