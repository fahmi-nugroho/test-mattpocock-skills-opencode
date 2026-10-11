import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PortfolioItem } from "./database";
import { deleteImageByUrl } from "./admin-storage";

type TypedClient = SupabaseClient<Database>;

export interface PortfolioInsert {
  title: string;
  category: string;
  image_url: string;
  sort: number;
  visible: boolean;
}

export type PortfolioPatch = Partial<PortfolioInsert>;

/**
 * Admin portfolio list (ticket 06): every row ordered by sort, hidden
 * included — unlike the public visible-only read in queries.ts. Call
 * with an authenticated browser client (`portfolio_items_admin_all`).
 */
export async function listPortfolioItemsAdmin(
  client: TypedClient,
): Promise<PortfolioItem[]> {
  const loose = client as unknown as {
    from(t: string): {
      select(c: string): {
        order(
          c: string,
          o: { ascending: boolean },
        ): Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
  };
  const { data, error } = await loose
    .from("portfolio_items")
    .select("*")
    .order("sort", { ascending: true });
  if (error) throw new Error(`Failed to load portfolio items: ${error.message}`);
  if (!Array.isArray(data)) return [];
  return data as PortfolioItem[];
}

/**
 * Admin portfolio create (ticket 06). Caller validates via
 * validatePortfolioInput and uploads the image to `portfolio/` first,
 * passing the public URL as image_url.
 */
export async function createPortfolioItem(
  client: TypedClient,
  input: PortfolioInsert,
): Promise<PortfolioItem> {
  const loose = client as unknown as {
    from(t: string): {
      insert(v: unknown): {
        select(): {
          single(): Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    };
  };
  const { data, error } = await loose
    .from("portfolio_items")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(`Failed to create portfolio item: ${error.message}`);
  return data as PortfolioItem;
}

/**
 * Admin portfolio update (ticket 06): partial patch by id.
 */
export async function updatePortfolioItem(
  client: TypedClient,
  id: string,
  patch: PortfolioPatch,
): Promise<PortfolioItem> {
  const loose = client as unknown as {
    from(t: string): {
      update(v: unknown): {
        eq(c: string, v: string): {
          select(): {
            single(): Promise<{
              data: unknown;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
  };
  const { data, error } = await loose
    .from("portfolio_items")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`Failed to update portfolio item: ${error.message}`);
  return data as PortfolioItem;
}

/**
 * Admin portfolio delete with storage cleanup (ticket 06): removes the
 * row, then its `portfolio/` object when imageUrl parses to that bucket.
 * Storage errors are best-effort (row delete already won); row errors
 * propagate so the UI never pretends a failed delete succeeded.
 */
export async function deletePortfolioItem(
  client: TypedClient,
  id: string,
  imageUrl: string | null,
): Promise<void> {
  const loose = client as unknown as {
    from(t: string): {
      delete(): {
        eq(
          c: string,
          v: string,
        ): Promise<{ error: { message: string } | null }>;
      };
    };
  };
  const { error } = await loose.from("portfolio_items").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete portfolio item: ${error.message}`);
  try {
    await deleteImageByUrl(client, "portfolio", imageUrl);
  } catch {
    // Best-effort: the row is gone; an orphaned object is harmless
    // (public-read bucket, no PII) and can be pruned from storage.
  }
}
