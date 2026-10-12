import { AvailabilityCalendar } from "@/components/availability-calendar";
import { PortfolioGrid } from "@/components/portfolio-grid";
import { PriceList } from "@/components/price-list";
import { WaFloat } from "@/components/wa-float";
import type {
  PortfolioItem,
  Service,
} from "@/lib/supabase/database";
import { getVisiblePortfolioItems, getActiveServices } from "@/lib/supabase/queries";
import { getPublicWaNumber } from "@/lib/supabase/public-settings";
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

async function getLandingData(): Promise<{
  services: Service[];
  portfolio: PortfolioItem[];
  waNumber: string;
}> {
  try {
    const supabase = supabaseServer();
    const [services, portfolio, waNumber] = await Promise.all([
      getActiveServices(supabase),
      getVisiblePortfolioItems(supabase),
      getPublicWaNumber(supabase),
    ]);
    return { services, portfolio, waNumber };
  } catch {
    // Landing stays readable when the backend is unreachable: empty
    // sections with WA fallback instead of a 500.
    return { services: [], portfolio: [], waNumber: FALLBACK_WA_NUMBER };
  }
}

export default async function Home() {
  const { services, portfolio, waNumber } = await getLandingData();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
      {/* Hero: centered copy + both CTAs. Stays single-column in this
          ticket — the 2-column copy+portrait layout lands in ticket 02
          (hero-trust) with the owner portrait, trust stats, and
          testimonials. */}
      <section className="mx-auto max-w-2xl py-14 text-center sm:py-20">
        <p className="text-sm font-medium uppercase tracking-widest text-gold">
          Makeup Artist
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
          Tampil memukau di hari spesialmu
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-stone-600">
          Lihat portfolio, pilih layanan, lalu diskusikan tanggal dan waktu
          langsung via WhatsApp — tanpa daftar akun.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
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
      </section>

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
        <PortfolioGrid items={portfolio} />
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
