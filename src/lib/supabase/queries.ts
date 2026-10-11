import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  PortfolioItem,
  Service,
} from "./database";

type TypedClient = SupabaseClient<Database>;

/**
 * Public reads (anon-safe by RLS): active services ordered by sort.
 * Mirrors the services_public_read policy (active = true).
 */
export async function getActiveServices(
  client: TypedClient,
): Promise<Service[]> {
  const { data, error } = await client
    .from("services")
    .select("*")
    .eq("active", true)
    .order("sort", { ascending: true });
  if (error) throw new Error(`Failed to load services: ${error.message}`);
  return data ?? [];
}

/**
 * Public reads (anon-safe by RLS): visible portfolio items ordered by sort.
 * Mirrors the portfolio_items_public_read policy (visible = true).
 */
export async function getVisiblePortfolioItems(
  client: TypedClient,
): Promise<PortfolioItem[]> {
  const { data, error } = await client
    .from("portfolio_items")
    .select("*")
    .eq("visible", true)
    .order("sort", { ascending: true });
  if (error) {
    throw new Error(`Failed to load portfolio items: ${error.message}`);
  }
  return data ?? [];
}
