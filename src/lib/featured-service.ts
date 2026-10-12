import type { Service } from "./supabase/database";

/** Badge copy for the top-sorted active service (ticket 04-price-badge). */
export const FEATURED_BADGE_LABEL = "Paling Dipilih";

/**
 * Featured-service selector: first active service by ascending sort,
 * else null. Pure — never mutates the input. The owner controls the
 * badge through the existing sort field; no schema change.
 */
export function getFeaturedService(services: Service[]): Service | null {
  let featured: Service | null = null;
  for (const service of services) {
    if (!service.active) continue;
    if (featured === null || service.sort < featured.sort) {
      featured = service;
    }
  }
  return featured;
}
