import { NextResponse } from "next/server";
import { isCronAuthorized, readCronSecret } from "@/lib/google/cron-auth";
import { reconcileMirror } from "@/lib/google/mirror";
import {
  createMirrorRuntimeFactory,
  readMirrorConfig,
} from "@/lib/google/runtime";
import { supabaseAdminServer } from "@/lib/supabase/server";

// This is the only scheduled entry point for the Calendar Mirror. Vercel Cron
// calls it once a day near midnight WIB; the admin "Resync semua" action runs
// the exact same reconcile routine through the authenticated admin route.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim() !== ""
    ? error.message
    : "Terjadi kesalahan yang tidak diketahui.";
}

async function handleCronRequest(request: Request) {
  const secret = readCronSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Cron Google Calendar belum dikonfigurasi di server." },
      { status: 500 },
    );
  }
  if (!isCronAuthorized(request, secret)) {
    return NextResponse.json({ error: "Tidak berwenang." }, { status: 401 });
  }

  let client;
  try {
    client = supabaseAdminServer();
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }

  try {
    const summary = await reconcileMirror(
      client,
      createMirrorRuntimeFactory(readMirrorConfig()),
    );
    // A mirror failure is returned as a summary rather than a server error, so
    // the cron log shows counts without exposing credentials or client data.
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleCronRequest(request);
}
