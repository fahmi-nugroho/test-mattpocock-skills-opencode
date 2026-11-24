import { AvailabilityCalendar } from "@/components/availability-calendar";
import { PortfolioGrid } from "@/components/portfolio-grid";
import { PriceList } from "@/components/price-list";
import { HeroTrust, LandingProof } from "@/components/hero-trust";
import { WaFloat } from "@/components/wa-float";
import { BUSINESS_NAME } from "@/lib/brand";
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
import { buildGeneralWaLink } from "@/lib/whatsapp";

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

/** Unwrap a Promise.allSettled result, falling back on rejection. */
function settledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

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
    return {
      services: settledValue(services, []),
      portfolio: settledValue(portfolio, []),
      testimonials: settledValue(testimonials, []),
      stats: settledValue(stats, []),
      profile: settledValue(profileResult, null),
      waNumber: settledValue(waNumber, FALLBACK_WA_NUMBER),
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
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-3 border-b border-stone-200 py-2">
        <p className="font-display text-lg font-bold sm:text-xl">{BUSINESS_NAME}</p>
        <nav aria-label="Navigasi halaman">
          <a href="#harga" className="inline-flex min-h-11 items-center text-sm font-semibold text-stone-700 hover:underline hover:underline-offset-4">
            Harga &amp; layanan
          </a>
        </nav>
      </header>
      <HeroTrust portfolio={portfolio} profile={profile} />

      <section
        id="portfolio"
        aria-labelledby="portfolio-heading"
        className="scroll-mt-4 border-t border-stone-200 py-7 sm:py-9"
      >
        <h2 id="portfolio-heading" className="mb-4 font-display text-2xl font-bold sm:text-3xl">
          Portofolio
        </h2>
        <PortfolioGrid items={portfolio} waNumber={waNumber} />
      </section>

      <section
        id="harga"
        aria-labelledby="harga-heading"
        className="scroll-mt-4 border-t border-stone-200 py-7 sm:py-9"
      >
        <h2 id="harga-heading" className="mb-4 font-display text-2xl font-bold sm:text-3xl">
          Harga &amp; Layanan
        </h2>
        <PriceList services={services} waNumber={waNumber} />
      </section>

      <section
        id="jadwal"
        aria-labelledby="jadwal-heading"
        className="scroll-mt-4 border-t border-stone-200 py-7 sm:py-9"
      >
        <h2 id="jadwal-heading" className="font-display text-2xl font-bold sm:text-3xl">Jadwal</h2>
        <p className="mb-4 mt-2 max-w-prose text-sm text-stone-600">
          Pilih tanggal untuk melihat jam yang sudah terisi. Penata rias akan mengonfirmasi ketersediaan lewat WhatsApp.
        </p>
        <AvailabilityCalendar waNumber={waNumber} />
      </section>

      <LandingProof stats={stats} testimonials={testimonials} />

      <footer className="border-t border-stone-200 py-8 text-center">
        <p className="font-display text-lg font-bold">{BUSINESS_NAME}</p>
        <p className="mt-1 text-sm text-stone-600">
          <a href={buildGeneralWaLink(waNumber)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-semibold text-green-800 underline underline-offset-4">
            Pemesanan dan konsultasi via WhatsApp
          </a>
        </p>
        <p className="mt-4 text-xs text-stone-500">
          © {new Date().getFullYear()} {BUSINESS_NAME}
        </p>
      </footer>

      <WaFloat waNumber={waNumber} hideWhileVisible="jadwal" />
    </main>
  );
}
