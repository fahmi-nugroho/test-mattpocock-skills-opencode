import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database";

type TypedClient = SupabaseClient<Database>;

/**
 * Public WA number fetch (ticket 03). The raw settings table stays
 * anon-denied (0002_rls.sql); the public landing reads only wa_number
 * through the `get_public_wa_number` RPC (0005 migration), so operating
 * hours and full_dates never reach the browser.
 */
export async function getPublicWaNumber(client: TypedClient): Promise<string> {
  // Loose structural surface: the typed client's rpc generics can't
  // express "any text-returning RPC" without leaking function specifics.
  const loose = client as unknown as {
    rpc(
      name: string,
      args: Record<string, unknown>,
    ): Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await loose.rpc("get_public_wa_number", {});
  if (error) throw new Error(`Public WA number RPC failed: ${error.message}`);
  if (typeof data !== "string" || data.replace(/\D/g, "").length === 0) {
    throw new Error("Public WA number is missing");
  }
  return data;
}
