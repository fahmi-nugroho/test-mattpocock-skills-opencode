import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PortfolioItem } from "./database";
import {
  deleteImageBestEffort,
} from "./admin-storage";
import {
  deleteRowById,
  insertRow,
  listOrderedBySort,
  updateRowById,
  type DeleteWithCleanupResult,
} from "./admin-crud";

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
  return listOrderedBySort<PortfolioItem>(
    client,
    "portfolio_items",
    "Failed to load portfolio items",
  );
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
  return insertRow<PortfolioItem>(
    client,
    "portfolio_items",
    input,
    "Failed to create portfolio item",
  );
}

/**
 * Admin portfolio update (ticket 06): partial patch by id.
 */
export async function updatePortfolioItem(
  client: TypedClient,
  id: string,
  patch: PortfolioPatch,
): Promise<PortfolioItem> {
  return updateRowById<PortfolioItem>(
    client,
    "portfolio_items",
    id,
    patch,
    "Failed to update portfolio item",
  );
}

/**
 * Admin portfolio delete with storage cleanup (ticket 06): removes the
 * row, then its `portfolio/` object when imageUrl parses to that bucket.
 * Row errors propagate so the UI never pretends a failed delete
 * succeeded; a failed storage prune is reported via cleanupOk (row
 * delete already won) so the UI can warn instead of silently orphaning.
 */
export async function deletePortfolioItem(
  client: TypedClient,
  id: string,
  imageUrl: string | null,
): Promise<DeleteWithCleanupResult> {
  await deleteRowById(
    client,
    "portfolio_items",
    id,
    "Failed to delete portfolio item",
  );
  const cleanupOk = await deleteImageBestEffort(client, "portfolio", imageUrl);
  return { cleanupOk };
}
