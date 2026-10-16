import { AvailabilityCalendar } from "@/components/availability-calendar";
import { PortfolioGrid } from "@/components/portfolio-grid";
import { PriceList } from "@/components/price-list";
import { HeroTrust } from "@/components/hero-trust";
import { WaFloat } from "@/components/wa-float";
import type {
  PortfolioItem,
  ProfileStatRow,
  Service,
  TestimonialRow,
} from "@/lib/supabase/database";
import {
  getVisiblePortfolioItems,
  getActiveServices,
  getVisibleProfileStats,
  getVisibleTestimonials,
} from "@/lib/supabase/queries";
import { getPublicWaNumber } from "@/lib/supabase/public-settings";
import {
  getPublicProfile,
  type PublicProfile,
} from "@/lib/supabase/public-profile";
import { supabaseServer } from "@/lib/supabase/server";

// Ticket 06: no ISR cache — admin portfolio/price edits read the same
// tables live, so the landing reflects them on the very next load.
// Global (not per-section) is the available scope: this is a single route,
// and admin writes go through client-side Supabase, so no server action
// exists that could call revalidatePath. "Instantly" means next load;
// already-open tabs don't live-update (no realtime subscription in v1).
export const revalidate = 0;

/** Fallback contact when the WA RPC has no value yet (seed placeholder). */
const FALLBACK_WA_NUMBER =
  process.env.NEXT_PUBLIC_WA_NUMBER ?? "6280000000000";

async function getLandingData(): Promise<{
  services: Service[];
  portfolio: PortfolioItem[];
  testimonials: TestimonialRow[];
  stats: ProfileStatRow[];
  profile: PublicProfile | null;
  waNumber: string;
}> {
  try {
    const supabase = supabaseServer();
    const [services, portfolio, testimonials, stats, profileResult, waNumber] =
      await Promise.allSettled([
        getActiveServices(supabase),
        getVisiblePortfolioItems(supabase),
        getVisibleTestimonials(supabase),
        getVisibleProfileStats(supabase),
        getPublicProfile(supabase),
        getPublicWaNumber(supabase),
      ]);
    // Profil/stats/testimoni fall back to hardcoded landing content when
    // their reads fail; services/portfolio fall back to empty sections.
    // WA keeps its env fallback. The landing never 500s on backend
    // failure (ticket 03: empty settings/stats → hardcoded fallback).
    if (waNumber.status === "rejected") throw waNumber.reason;
    return {
      services:
        services.status === "fulfilled" ? services.value : [],
      portfolio:
        portfolio.status === "fulfilled" ? portfolio.value : [],
      testimonials:
        testimonials.status === "fulfilled" ? testimonials.value : [],
      stats: stats.status === "fulfilled" ? stats.value : [],
      profile:
        profileResult.status === "fulfilled" ? profileResult.value : null,
      waNumber: waNumber.value,
    };
  } catch {
    // Landing stays readable when the backend is unreachable: empty
    // sections with WA fallback instead of a 500.
    return {
      services: [],
      portfolio: [],
      testimonials: [],
      stats: [],
      profile: null,
      waNumber: FALLBACK_WA_NUMBER,
    };
  }
}

export default async function Home() {
  const { services, portfolio, testimonials, stats, profile, waNumber } =
    await getLandingData();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
      {/* Hero trust block (ticket 03): live profil + stats, hardcoded fallback. */}
      <HeroTrust
        portfolio={portfolio}
        testimonials={testimonials}
        stats={stats}
        profile={profile}
        waNumber={waNumber}
      />

      <section
        id="portfolio"
        aria-label="Portfolio"
        className="scroll-mt-6 py-8"
      >
        <h2 className="font-display text-2xl font-bold sm:text-3xl">
          Portfolio
        </h2>
        <p className="mb-4 mt-1 text-sm text-stone-600">
          Filter berdasarkan kategori untuk melihat gaya riasan.
        </p>
        <PortfolioGrid items={portfolio} waNumber={waNumber} />
      </section>

      <section
        id="harga"
        aria-label="Harga dan layanan"
        className="mx-auto max-w-5xl scroll-mt-6 py-8"
      >
        <h2 className="font-display text-2xl font-bold sm:text-3xl">
          Harga &amp; Layanan
        </h2>
        <p className="mb-4 mt-1 text-sm text-stone-600">
          Ketuk tombol WhatsApp pada layanan untuk bertanya langsung.
        </p>
        <PriceList services={services} waNumber={waNumber} />
      </section>

      <section
        id="jadwal"
        aria-label="Jadwal"
        className="mx-auto max-w-3xl scroll-mt-6 py-8"
      >
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Jadwal</h2>
        <p className="mb-4 mt-1 text-sm text-stone-600">
          Cek perkiraan ketersediaan per tanggal, lalu tanyakan tanggal yang
          kamu mau langsung via WhatsApp.
        </p>
        <AvailabilityCalendar waNumber={waNumber} />
      </section>

      <WaFloat waNumber={waNumber} />
    </main>
  );
}
