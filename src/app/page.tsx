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
    <main className="mx-auto max-w-3xl px-4 pb-24">
      <section className="py-14 text-center sm:py-20">
        <p className="text-sm font-medium uppercase tracking-widest text-neutral-500">
          Makeup Artist
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
          Tampil memukau di hari spesialmu
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-neutral-600">
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
            className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700"
          >
            Lihat Harga
          </a>
        </div>
      </section>

      <section id="portfolio" aria-label="Portfolio" className="py-8">
        <h2 className="text-xl font-bold">Portfolio</h2>
        <p className="mb-4 mt-1 text-sm text-neutral-600">
          Filter berdasarkan kategori untuk melihat gaya riasan.
        </p>
        <PortfolioGrid items={portfolio} />
      </section>

      <section id="harga" aria-label="Harga dan layanan" className="py-8">
        <h2 className="text-xl font-bold">Harga &amp; Layanan</h2>
        <p className="mb-4 mt-1 text-sm text-neutral-600">
          Ketuk tombol WhatsApp pada layanan untuk bertanya langsung.
        </p>
        <PriceList services={services} waNumber={waNumber} />
      </section>

      <section id="jadwal" aria-label="Jadwal" className="py-8">
        <h2 className="text-xl font-bold">Jadwal</h2>
        <p className="mb-4 mt-1 text-sm text-neutral-600">
          Cek perkiraan ketersediaan per tanggal, lalu tanyakan tanggal yang
          kamu mau langsung via WhatsApp.
        </p>
        <AvailabilityCalendar waNumber={waNumber} />
      </section>

      <WaFloat waNumber={waNumber} />
    </main>
  );
}
