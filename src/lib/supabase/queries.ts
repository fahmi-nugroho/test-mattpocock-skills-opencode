import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  PortfolioItem,
  Service,
} from "./database";

type TypedClient = SupabaseClient<Database>;

/**
 * Ticket 02 shared helper: ordered public list read (active services /
 * visible portfolio). Both queries share the same shape — select-all,
 * boolean flag filter, sort ascending — differing only in table/flag.
 * Covers the services_public_read / portfolio_items_public_read RLS
 * policies (0002_rls.sql); wrappers below stay thin and typed.
 */
async function queryOrderedPublicList<T>(
  client: TypedClient,
  table: string,
  flagColumn: string,
  errorLabel: string,
): Promise<T[]> {
  // Loose structural surface: the typed client's generics can't express
  // "any flag-filtered table" without leaking table specifics in here.
  const loose = client as unknown as {
    from(t: string): {
      select(c: string): {
        eq(c: string, v: boolean): {
          order(
            c: string,
            o: { ascending: boolean },
          ): Promise<{
            data: T[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  const { data, error } = await loose
    .from(table)
    .select("*")
    .eq(flagColumn, true)
    .order("sort", { ascending: true });
  if (error) throw new Error(`${errorLabel}: ${error.message}`);
  return data ?? [];
}

/**
 * Public reads (anon-safe by RLS): active services ordered by sort.
 * Mirrors the services_public_read policy (active = true).
 */
export async function getActiveServices(
  client: TypedClient,
): Promise<Service[]> {
  return queryOrderedPublicList<Service>(
    client,
    "services",
    "active",
    "Failed to load services",
  );
}

/**
 * Public reads (anon-safe by RLS): visible portfolio items ordered by sort.
 * Mirrors the portfolio_items_public_read policy (visible = true).
 */
export async function getVisiblePortfolioItems(
  client: TypedClient,
): Promise<PortfolioItem[]> {
  return queryOrderedPublicList<PortfolioItem>(
    client,
    "portfolio_items",
    "visible",
    "Failed to load portfolio items",
  );
}
