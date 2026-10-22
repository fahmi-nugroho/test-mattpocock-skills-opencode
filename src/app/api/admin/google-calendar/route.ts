import { NextResponse } from "next/server";
import {
  connectCalendar,
  disconnectCalendar,
  getConnection,
  testCalendarConnection,
  MIRROR_DISABLED_ERROR,
} from "@/lib/google/calendar-connection";
import type { GoogleCalendarStatus } from "@/lib/google/connection-status";
import { drainMirrorQueue, reconcileMirror } from "@/lib/google/mirror";
import {
  createMirrorRuntimeFactory,
  readMirrorConfig,
} from "@/lib/google/runtime";
import { requireAdminClient } from "@/lib/supabase/server";

// node:crypto signs the service-account JWT, so this route must stay on the
// Node runtime. Every action verifies the admin's Supabase access token first;
// the browser never receives a Google credential.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const config = readMirrorConfig();
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

    const makeRuntime = createMirrorRuntimeFactory(readMirrorConfig());

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

    // "Resync semua": the same reconcile routine the daily cron runs.
    if (action === "resync") {
      const summary = await reconcileMirror(client, makeRuntime);
      return NextResponse.json(summary);
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
