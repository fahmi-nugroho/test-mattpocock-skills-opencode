import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Settings } from "./database";
import type { SettingsInput } from "../admin/validate-settings";

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
 * Admin settings write (hours-removal contract). Persists wa_number only
 * on row id = 1. The operating-hours columns were dropped (see migration
 * 0012); the public month/day RPCs read full_dates live, so the calendar
 * derivation reflects full-toggle edits without extra wiring. Caller
 * validates via validateSettingsInput first.
 */
export async function updateSettings(
  client: TypedClient,
  input: SettingsInput,
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
    })
    .eq("id", 1);
  if (error) throw new Error(`Failed to save settings: ${error.message}`);
}
