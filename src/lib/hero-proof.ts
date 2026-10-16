/**
 * Hero trust content (ticket 02-hero-trust): hardcoded stats + testimonials
 * in one editable location. No new table — the owner edits these literals
 * directly. Portrait: owner-supplied URL via NEXT_PUBLIC_HERO_PORTRAIT,
 * else the first visible portfolio cover (see getHeroPortraitUrl).
 */

export interface HeroStat {
  value: string;
  label: string;
}

export const HERO_STATS: HeroStat[] = [
  { value: "5+ Tahun", label: "Pengalaman" },
  { value: "500+", label: "Klien" },
  { value: "4.9★", label: "Rating" },
];

export interface Testimonial {
  quote: string;
  name: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote: "Riasannya natural tapi tahan lama, nyaman dipakai seharian.",
    name: "Dinda, Pengantin",
  },
  {
    quote: "Ramah dan tepat waktu, hasilnya sesuai referensi yang kumau.",
    name: "Salsa, Wisuda",
  },
  {
    quote: "Sudah langganan untuk acara keluarga, selalu memuaskan.",
    name: "Bu Ratna, Engagement",
  },
];

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

export interface DbTestimonial {
  quote: string;
  client_name: string;
  visible: boolean;
}

/**
 * DB rows → landing testimonial list (ticket 02 end-to-end). Empty or
 * all-hidden DB input falls back to the hardcoded TESTIMONIALS so the
 * section never appears blank; otherwise visible rows map
 * (client_name → name) and slice to MAX_VISIBLE_TESTIMONIALS. The public
 * query already filters visible=true + orders by sort; the filter here is
 * defense-in-depth so a hidden row can never leak into the landing.
 */
export function resolveDisplayedTestimonials(
  dbRows: readonly DbTestimonial[] | null | undefined,
): Testimonial[] {
  const visible = (dbRows ?? []).filter((row) => row.visible);
  if (visible.length === 0) return TESTIMONIALS;
  return visible
    .slice(0, MAX_VISIBLE_TESTIMONIALS)
    .map((row) => ({ quote: row.quote, name: row.client_name }));
}
