import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database";

// Server-side Supabase client (public reads via anon key; the month
// availability RPC exposes day-status only, so no PII reaches clients).
// Authenticated admin session handling lands with ticket 04.
export const supabaseServer = () =>
  createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

/**
 * Server client that forwards the admin's Supabase access token so the
 * `authenticated` RLS policies apply. Used by Node-runtime admin routes (the
 * Google Calendar connection in ticket 01); the browser never sees a Google
 * credential.
 */
export const supabaseServerWithToken = (accessToken: string) =>
  createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
  );

/**
 * Service-role client for jobs that have no admin session, such as the daily
 * Google Calendar cron. The key is server-only and must never be prefixed
 * `NEXT_PUBLIC_`; it bypasses RLS, so this is only for trusted route code.
 */
export function supabaseAdminServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Konfigurasi server Supabase belum lengkap untuk tugas terjadwal.",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Verify the request's bearer access token and return an RLS-bound client.
 * Returns null for a missing, expired, or invalid admin session.
 */
export async function requireAdminClient(
  request: Request,
): Promise<SupabaseClient<Database> | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim();
  if (!token) return null;

  const client = supabaseServerWithToken(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return client;
}
