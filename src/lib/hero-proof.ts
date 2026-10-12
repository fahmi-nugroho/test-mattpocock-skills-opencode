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
