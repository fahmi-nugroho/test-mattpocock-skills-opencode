import type { PortfolioItem } from "./supabase/database";

/** "All" filter label (ID copy, v1 caps categories at six). */
export const ALL_CATEGORIES_LABEL = "Semua";

/** Max distinct categories shown (spec: ~6 for v1, plus Semua). */
export const MAX_CATEGORIES = 6;

/**
 * Unique categories in first-seen order, prefixed with Semua.
 * Pure helper for the filterable portfolio grid (ticket 03).
 */
export function getPortfolioCategories(items: PortfolioItem[]): string[] {
  const seen: string[] = [];
  for (const item of items) {
    if (!seen.includes(item.category)) seen.push(item.category);
    if (seen.length >= MAX_CATEGORIES) break;
  }
  return [ALL_CATEGORIES_LABEL, ...seen];
}

/**
 * Filter visible portfolio items by category.
 * "Semua" returns every item; otherwise exact category match.
 */
export function filterPortfolioItems(
  items: PortfolioItem[],
  category: string,
): PortfolioItem[] {
  if (category === ALL_CATEGORIES_LABEL) return items;
  return items.filter((item) => item.category === category);
}
