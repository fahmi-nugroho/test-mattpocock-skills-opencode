export interface HeroStat {
  id?: string | number;
  value: string;
  label: string;
}

/** Hardcoded hero copy fallback (mirrors the 0013 settings defaults). */
export const FALLBACK_HEADLINE = "Tampil memukau di hari spesialmu";
export const FALLBACK_SUBCOPY =
  "Lihat portfolio, pilih layanan, lalu diskusikan tanggal dan waktu langsung via WhatsApp — tanpa daftar akun.";

export interface Testimonial {
  id?: string | number;
  quote: string;
  name: string;
}

/**
 * Hero portrait fallback: first visible portfolio cover (portfolio is
 * already ordered by sort via getVisiblePortfolioItems).
 */
export function getHeroPortraitUrl(
  items: Array<{ image_url: string }>,
): string | null {
  return items[0]?.image_url ?? null;
}

/** At most this many testimonials render on the public landing. */
export const MAX_VISIBLE_TESTIMONIALS = 6;

/** At most this many stats render on the public landing. */
export const MAX_VISIBLE_STATS = 4;

export interface DbTestimonial {
  id?: string | number;
  quote: string;
  client_name: string;
  sort?: number;
  visible: boolean;
}

export interface DbProfileStat {
  id?: string | number;
  value: string;
  label: string;
  sort?: number;
  visible: boolean;
}

/**
 * Shared visible → ordered → sliced resolver (ticket 03 review). Both
 * testimonial and stat lists filter visible=true, defensive-sort by `sort`
 * ascending (rows without `sort` sort last), and slice to their max. The
 * public query already filters visible + orders by sort; this is
 * defense-in-depth so a hidden row can never leak into the landing.
 */
function resolveVisibleOrdered<
  T extends { sort?: number; visible: boolean },
>(dbRows: readonly T[] | null | undefined, max: number): T[] {
  return [...(dbRows ?? []).filter((row) => row.visible)]
    .sort(
      (a, b) =>
        (a.sort ?? Number.MAX_SAFE_INTEGER) -
        (b.sort ?? Number.MAX_SAFE_INTEGER),
    )
    .slice(0, max);
}

// DbTestimonial/DbProfileStat intentionally stay local (not `import type`
// from database Row types): the landing seam only needs this subset, and
// the sort field is optional here (rows without sort sort last) while the
// DB Row requires it. Reuse is noted as deferred, not done.

export interface HeroProfile {
  headline: string;
  subcopy: string;
  portrait_url?: string | null;
}

export function resolveDisplayedTestimonials(
  dbRows: readonly DbTestimonial[] | null | undefined,
): Testimonial[] {
  const visible = resolveVisibleOrdered(dbRows, MAX_VISIBLE_TESTIMONIALS);
  return visible.map((row) => ({
    ...(row.id !== undefined ? { id: row.id } : {}),
    quote: row.quote,
    name: row.client_name,
  }));
}

export function resolveDisplayedStats(
  dbRows: readonly DbProfileStat[] | null | undefined,
): HeroStat[] {
  const visible = resolveVisibleOrdered(dbRows, MAX_VISIBLE_STATS);
  return visible.map((row) => ({
    ...(row.id !== undefined ? { id: row.id } : {}),
    value: row.value,
    label: row.label,
  }));
}

/**
 * Portrait fallback (ticket 03): admin portrait URL wins; blank/null
 * falls back to the first visible portfolio cover; null when neither
 * exists so the hero renders its placeholder state.
 */
export function resolveHeroPortraitUrl(
  portraitUrl: string | null | undefined,
  items: Array<{ image_url: string }>,
): string | null {
  const trimmed = (portraitUrl ?? "").trim();
  if (trimmed) return trimmed;
  return getHeroPortraitUrl(items);
}

/**
 * Hero copy fallback (ticket 03): live headline/subcopy when the public
 * profile row has non-blank text; hardcoded FALLBACK_HEADLINE/SUBCOPY
 * otherwise so the hero never renders blank on an empty database.
 */
export function resolveHeroCopy(
  profile: { headline: string; subcopy: string } | null | undefined,
): { headline: string; subcopy: string } {
  const headline = (profile?.headline ?? "").trim();
  const subcopy = (profile?.subcopy ?? "").trim();
  return {
    headline: headline || FALLBACK_HEADLINE,
    subcopy: subcopy || FALLBACK_SUBCOPY,
  };
}
