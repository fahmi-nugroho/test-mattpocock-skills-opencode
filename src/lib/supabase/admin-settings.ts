import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Settings } from "./database";
import type { ValidatedSettingsInput } from "../admin/validate-settings";
import type { ProfileInput } from "../admin/validate-profile";

type TypedClient = SupabaseClient<Database>;

/**
 * Admin settings read (ticket 05). The settings table is anon-denied
 * (0002_rls.sql); call with an authenticated browser client so the
 * `settings_admin_all` policy applies. Single row id = 1 by CHECK.
 */
export async function getSettings(client: TypedClient): Promise<Settings> {
  const loose = client as unknown as {
    from(t: string): {
      select(c: string): {
        eq(
          c: string,
          v: number,
        ): { single(): Promise<{ data: unknown; error: { message: string } | null }> };
      };
    };
  };
  const { data, error } = await loose
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw new Error(`Failed to load settings: ${error.message}`);
  if (data === null || typeof data !== "object") {
    throw new Error("Settings row is missing (id = 1)");
  }
  return data as Settings;
}

/**
 * Admin settings write (ticket 07). Persists the WA number and the four
 * payment details on row id = 1. The operating-hours columns were dropped
 * (see migration 0012); the public month/day RPCs read full_dates live, so the
 * calendar derivation reflects full-toggle edits without extra wiring. Empty
 * payment fields are saved as `''` — the Invoice picture prints an em dash.
 * Caller validates via validateSettingsInput first.
 */
export async function updateSettings(
  client: TypedClient,
  input: ValidatedSettingsInput,
): Promise<void> {
  const loose = client as unknown as {
    from(t: string): {
      update(v: Record<string, string>): {
        eq(c: string, v: number): Promise<{ error: { message: string } | null }>;
      };
    };
  };
  const { error } = await loose
    .from("settings")
    .update({
      wa_number: input.wa_number,
      bank_name: input.bank_name,
      account_name: input.account_name,
      account_number: input.account_number,
      instagram_handle: input.instagram_handle,
    })
    .eq("id", 1);
  if (error) throw new Error(`Failed to save settings: ${error.message}`);
}

/**
 * Admin profil write (ticket 03). Persists headline/subcopy/portrait_url
 * on row id = 1. Caller validates via validateProfileInput first; the
 * portrait URL is either an uploaded `profile/` public URL or a manual
 * HTTPS URL (null clears back to the portfolio-cover fallback).
 */
export async function updateProfileSettings(
  client: TypedClient,
  input: ProfileInput,
): Promise<void> {
  const loose = client as unknown as {
    from(t: string): {
      update(v: Record<string, string | null>): {
        eq(c: string, v: number): Promise<{ error: { message: string } | null }>;
      };
    };
  };
  const { error } = await loose
    .from("settings")
    .update({
      headline: input.headline,
      subcopy: input.subcopy,
      portrait_url: input.portrait_url,
    })
    .eq("id", 1);
  if (error) throw new Error(`Failed to save profile: ${error.message}`);
}
