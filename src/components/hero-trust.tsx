import Image from "next/image";
import type { PortfolioItem, ProfileStatRow, TestimonialRow } from "@/lib/supabase/database";
import {
  resolveDisplayedStats,
  resolveDisplayedTestimonials,
  resolveHeroCopy,
  resolveHeroPortraitUrl,
} from "@/lib/hero-proof";
import type { PublicProfile } from "@/lib/supabase/public-profile";

const OWNER_PORTRAIT_URL = process.env.NEXT_PUBLIC_HERO_PORTRAIT ?? "";
const PUBLIC_STAT_LABELS = new Map([["client", "Klien"], ["rating", "Penilaian"]]);

export function HeroTrust({
  portfolio,
  profile,
}: {
  portfolio: PortfolioItem[];
  profile: PublicProfile | null;
}) {
  const leadLook = portfolio[0];
  const imageUrl = leadLook?.image_url ?? resolveHeroPortraitUrl(
    profile?.portrait_url?.trim() || OWNER_PORTRAIT_URL,
    portfolio,
  );
  const { headline, subcopy } = resolveHeroCopy(profile);

  return (
    <section
      aria-label="Perkenalan"
      className={`grid items-center gap-6 pb-9 pt-3 sm:gap-8 sm:pb-12 sm:pt-5 ${imageUrl ? "md:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:gap-14" : "max-w-2xl"}`}
    >
      {imageUrl ? (
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gold-soft sm:aspect-[16/10] md:aspect-[6/7] lg:aspect-square">
          <Image
            src={imageUrl}
            alt={leadLook?.title ?? "Potret penata rias Wandana Makeup"}
            fill
            sizes="(min-width: 1152px) 550px, (min-width: 768px) 50vw, 100vw"
            className="object-cover object-[center_22%]"
            loading="eager"
            fetchPriority="high"
          />
        </div>
      ) : null}
      <div className="min-w-0 py-1 md:py-6">
        <h1 className="max-w-xl text-balance break-words font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
          {headline}
        </h1>
        <p className="mt-3 max-w-prose break-words text-base leading-relaxed text-stone-700 sm:mt-4">
          {subcopy}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 sm:mt-7">
          <a
            href={leadLook ? "#portfolio" : "#harga"}
            className="inline-flex min-h-11 items-center rounded-full bg-espresso px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700"
          >
            {leadLook ? "Lihat hasil rias" : "Lihat harga"}
          </a>
          <a
            href="#jadwal"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-espresso underline decoration-stone-400 underline-offset-4 hover:decoration-current"
          >
            Cek jadwal
          </a>
        </div>
      </div>
    </section>
  );
}

export function LandingProof({
  stats,
  testimonials,
}: {
  stats: ProfileStatRow[];
  testimonials: TestimonialRow[];
}) {
  const displayedStats = resolveDisplayedStats(stats);
  const displayedTestimonials = resolveDisplayedTestimonials(testimonials);
  if (displayedStats.length === 0 && displayedTestimonials.length === 0) return null;

  return (
    <section aria-labelledby="testimoni-heading" className="border-t border-stone-200 py-8 sm:py-10">
      <h2 id="testimoni-heading" className="font-display text-2xl font-bold sm:text-3xl">
        {displayedTestimonials.length ? "Testimoni klien" : "Tentang Wandana Makeup"}
      </h2>
      {displayedStats.length > 0 ? (
        <dl className="mt-4 grid max-w-xl grid-cols-2 gap-4 sm:grid-cols-4">
          {displayedStats.map((stat, index) => (
            <div key={stat.id ?? `${stat.label}-${index}`} className="min-w-0 break-words">
              <dt className="text-sm text-stone-600">
                {PUBLIC_STAT_LABELS.get(stat.label.trim().toLowerCase()) ?? stat.label}
              </dt>
              <dd className="mt-1 text-lg font-semibold text-espresso">{stat.value.replaceAll("⭐", "★")}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {displayedTestimonials.length > 0 ? (
        <ul className="mt-5 grid gap-x-6 gap-y-4 md:grid-cols-3">
          {displayedTestimonials.map((testimonial, index) => (
            <li key={testimonial.id ?? `${testimonial.name}-${index}`} className="min-w-0 border-t border-stone-200 pt-3 break-words">
              <figure>
                <blockquote className="text-sm leading-relaxed text-stone-700">“{testimonial.quote}”</blockquote>
                <figcaption className="mt-2 text-sm font-medium text-stone-600">{testimonial.name}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
