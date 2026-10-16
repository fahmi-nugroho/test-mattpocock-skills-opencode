import Image from "next/image";
import type {
  PortfolioItem,
  ProfileStatRow,
  TestimonialRow,
} from "@/lib/supabase/database";
import { buildGeneralWaLink } from "@/lib/whatsapp";
import {
  resolveDisplayedStats,
  resolveDisplayedTestimonials,
  resolveHeroCopy,
  resolveHeroPortraitUrl,
} from "@/lib/hero-proof";
import type { PublicProfile } from "@/lib/supabase/public-profile";

/** Owner-supplied portrait; empty until the owner provides one. */
const OWNER_PORTRAIT_URL = process.env.NEXT_PUBLIC_HERO_PORTRAIT ?? "";

/**
 * Hero trust block (ticket 03): 2-column copy + portrait on desktop,
 * stacked on mobile. Trust stats and testimonials sit above the existing
 * WA CTAs; WA links and copy intent are unchanged from ticket 01.
 * Live profil (headline/subcopy/portrait) + stats render from the DB
 * when present, falling back to the hardcoded HERO_STATS / copy /
 * portfolio-cover portrait when the tables are empty.
 */
export function HeroTrust({
  portfolio,
  testimonials,
  stats,
  profile,
  waNumber,
}: {
  portfolio: PortfolioItem[];
  testimonials?: TestimonialRow[];
  stats?: ProfileStatRow[];
  profile?: PublicProfile | null;
  waNumber: string;
}) {
  // DB portrait wins; env portrait second; portfolio cover last; null
  // renders the placeholder state (empty portrait falls back to the
  // first portfolio cover, then to the existing placeholder).
  const portraitUrl = resolveHeroPortraitUrl(
    profile?.portrait_url || OWNER_PORTRAIT_URL || null,
    portfolio,
  );
  const { headline, subcopy } = resolveHeroCopy(
    profile ? { headline: profile.headline, subcopy: profile.subcopy } : null,
  );
  // DB-curated testimonials/stats when present, hardcoded fallbacks
  // when empty — the sections never render blank.
  const displayedTestimonials = resolveDisplayedTestimonials(testimonials);
  const displayedStats = resolveDisplayedStats(stats);

  return (
    <section
      aria-label="Perkenalan"
      className="grid grid-cols-1 items-center gap-8 py-14 sm:py-20 lg:grid-cols-2 lg:gap-12"
    >
      <div className="min-w-0 text-center lg:text-left">
        <p className="text-sm font-medium uppercase tracking-widest text-gold">
          Makeup Artist
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
          {headline}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-stone-600 lg:mx-0">
          {subcopy}
        </p>
        <dl className="mt-6 flex items-start justify-center gap-6 sm:gap-8 lg:justify-start">
          {displayedStats.map((stat, i) => (
            <div
              key={
                stat.id !== undefined ? String(stat.id) : `${stat.label}-${i}`
              }
              className="flex min-w-0 flex-col"
            >
              <dt className="order-2 mt-1 text-xs text-stone-600 sm:text-sm">
                {stat.label}
              </dt>
              <dd className="order-1 font-display text-xl font-bold sm:text-2xl">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
        <ul aria-label="Testimoni klien" className="mt-6 space-y-3 text-left">
          {displayedTestimonials.map((t, i) => (
            <li
              key={t.id ?? `${t.name}-${i}`}
              className="rounded-xl border border-stone-200/70 bg-white px-4 py-3 shadow-sm"
            >
              <p className="text-sm text-stone-700">“{t.quote}”</p>
              <p className="mt-1 text-xs font-medium text-stone-500">
                — {t.name}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
          <a
            href={buildGeneralWaLink(waNumber)}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-green-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            Chat WhatsApp
          </a>
          <a
            href="#harga"
            className="rounded-full bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700"
          >
            Lihat Harga
          </a>
        </div>
      </div>
      <div className="mx-auto w-full max-w-sm min-w-0 lg:mx-0 lg:max-w-none">
        {portraitUrl ? (
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-stone-200/70 bg-stone-100 shadow-sm">
            <Image
              src={portraitUrl}
              alt="Portrait makeup artist"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          </div>
        ) : (
          <div className="flex aspect-[4/5] items-center justify-center rounded-2xl border border-stone-200/70 bg-stone-100 p-6 text-center text-sm text-stone-500">
            Foto portrait segera hadir — silakan lihat portfolio di bawah.
          </div>
        )}
      </div>
    </section>
  );
}
