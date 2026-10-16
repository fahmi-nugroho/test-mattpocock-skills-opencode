import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database";

type TypedClient = SupabaseClient<Database>;

export interface PublicProfile {
  headline: string;
  subcopy: string;
  portrait_url: string | null;
}

/**
 * Public profil fetch (ticket 03). The raw settings table stays
 * anon-denied (0002_rls.sql + 0013); the public landing reads only
 * headline/subcopy/portrait_url through the `get_public_profile` RPC
 * (0014 migration), mirroring getPublicWaNumber — so wa_number-adjacent
 * internals (full_dates) never reach the browser.
 */
export async function getPublicProfile(
  client: TypedClient,
): Promise<PublicProfile> {
  // Loose structural surface: the typed client's rpc generics can't
  // express "any row-returning RPC" without leaking function specifics.
  const loose = client as unknown as {
    rpc(
      name: string,
      args: Record<string, unknown>,
    ): Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await loose.rpc("get_public_profile", {});
  if (error) throw new Error(`Public profile RPC failed: ${error.message}`);
  if (data === null || typeof data !== "object") {
    throw new Error("Public profile is missing");
  }
  const row = data as {
    headline?: unknown;
    subcopy?: unknown;
    portrait_url?: unknown;
  };
  if (typeof row.headline !== "string" || !row.headline.trim()) {
    throw new Error("Public profile is missing");
  }
  if (typeof row.subcopy !== "string" || !row.subcopy.trim()) {
    throw new Error("Public profile is missing");
  }
  return {
    headline: row.headline,
    subcopy: row.subcopy,
    portrait_url:
      typeof row.portrait_url === "string" && row.portrait_url.trim()
        ? row.portrait_url
        : null,
  };
}
