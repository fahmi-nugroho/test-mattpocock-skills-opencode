"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getTodayKey } from "@/lib/calendar";
import { ADMIN_TABS, parseAdminTab, type AdminTabId } from "@/lib/admin/admin-tabs";
import { summarizeBookings, type OverviewSummary } from "@/lib/admin/overview";
import { validateSettingsInput } from "@/lib/admin/validate-settings";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getOverviewBookings } from "@/lib/supabase/admin-overview";
import { SCHEDULE_CHANGED_EVENT } from "@/lib/admin/schedule-events";
import { getSettings, updateSettings } from "@/lib/supabase/admin-settings";
import { PortfolioManager } from "@/components/admin/portfolio-manager";
import { ServicesManager } from "@/components/admin/services-manager";
import { ProfileForm } from "@/components/admin/profile-form";
import { StatsManager } from "@/components/admin/stats-manager";
import { TestimonialsManager } from "@/components/admin/testimonials-manager";
import { BookingsManager } from "@/components/admin/bookings-manager";
import { RequestsManager } from "@/components/admin/requests-manager";
import { BlocksManager } from "@/components/admin/blocks-manager";
import { AdminCalendar } from "@/components/admin/admin-calendar";

const EMPTY_SUMMARY: OverviewSummary = {
  todayConfirmed: 0,
  todayPending: 0,
  upcomingConfirmed: 0,
  upcomingPending: 0,
};

/**
 * Guarded admin dashboard (ticket 05): browser-session guard redirects
 * to /admin/login without a session; authenticated reads use the same
 * browser client so the `authenticated` RLS policies apply. Shows
 * today/upcoming booking counts plus the WA-number settings form.
 */
export function AdminDashboard() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [summary, setSummary] = useState<OverviewSummary>(EMPTY_SUMMARY);
  const [requestCount, setRequestCount] = useState(0);
  const [waNumber, setWaNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settingsReady, setSettingsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Hash-driven tab state (no router): survives reload via
  // window.location.hash on mount, updates on hashchange from tab clicks.
  const [activeTab, setActiveTab] = useState<AdminTabId>(() =>
    typeof window !== "undefined"
      ? parseAdminTab(window.location.hash)
      : "ringkasan",
  );

  useEffect(() => {
    let cancelled = false;
    // Client created inside the effect (not during render) so static
    // prerender never touches env vars — same as AvailabilityCalendar.
    const supabase = supabaseBrowser();
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        router.replace("/admin/login");
        return;
      }
      setAuthed(true);
      try {
        const today = getTodayKey();
        const [settings, bookings] = await Promise.all([
          getSettings(supabase),
          getOverviewBookings(supabase, today),
        ]);
        if (cancelled) return;
        setSummary(summarizeBookings(bookings, today));
        setWaNumber(settings.wa_number);
        setSettingsReady(true);
      } catch {
        if (!cancelled) setLoadError("Gagal memuat data admin. Coba lagi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) router.replace("/admin/login");
      },
    );
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!authed) return;
    // Booking/block/full-toggle saves elsewhere on this page change the
    // same rows the overview counts derive from — refetch on the shared
    // schedule signal so Ringkasan Booking never visibly lags a
    // confirm/cancel until reload (same pattern as AdminCalendar).
    let cancelled = false;
    const onChange = () => {
      (async () => {
        try {
          const today = getTodayKey();
          const bookings = await getOverviewBookings(
            supabaseBrowser(),
            today,
          );
          if (!cancelled) setSummary(summarizeBookings(bookings, today));
        } catch {
          // Keep the last good summary; the mutating panel already
          // surfaces its own error next to the failed action.
        }
      })();
    };
    window.addEventListener(SCHEDULE_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(SCHEDULE_CHANGED_EVENT, onChange);
    };
  }, [authed]);

  useEffect(() => {
    const onHashChange = () => setActiveTab(parseAdminTab(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settingsReady || saving) return;
    setFormError(null);
    setSaved(false);
    let validated;
    try {
      validated = validateSettingsInput({
        wa_number: waNumber,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Input tidak valid");
      return;
    }
    setSaving(true);
    try {
      await updateSettings(supabaseBrowser(), validated);
      setWaNumber(validated.wa_number);
      setSaved(true);
    } catch {
      setFormError("Gagal menyimpan pengaturan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  async function onSignOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/admin/login");
  }

  if (!authed || loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-20">
        <p className="text-center text-sm text-neutral-600">
          {loadError ?? "Memuat dashboard…"}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Dashboard Admin</h1>
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-semibold transition hover:bg-neutral-100"
        >
          Keluar
        </button>
      </div>

      <nav
        aria-label="Navigasi dashboard"
        className="sticky top-0 z-10 -mx-4 mt-6 border-b border-neutral-200 bg-cream/95 backdrop-blur"
      >
        <ul className="flex gap-1 overflow-x-auto px-4">
          {ADMIN_TABS.map((tab) => (
            <li key={tab.id} className="shrink-0">
              <a
                href={`#${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? "location" : undefined}
                className={`block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? "border-gold text-gold-deep"
                    : "border-transparent text-neutral-600 hover:text-espresso"
                }`}
              >
                {tab.label}
                {tab.id === "permintaan" && requestCount > 0 ? (
                  <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {requestCount}
                  </span>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {loadError ? (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {loadError}
        </p>
      ) : null}

      <section id="ringkasan" aria-label="Ringkasan booking" className="mt-6 scroll-mt-24">
        <h2 className="font-display text-lg font-bold">Ringkasan Booking</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-500">Hari ini · Terkonfirmasi</p>
            <p className="mt-1 text-2xl font-bold">{summary.todayConfirmed}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-500">Hari ini · Menunggu</p>
            <p className="mt-1 text-2xl font-bold">{summary.todayPending}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-500">Mendatang · Terkonfirmasi</p>
            <p className="mt-1 text-2xl font-bold">
              {summary.upcomingConfirmed}
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-500">Mendatang · Menunggu</p>
            <p className="mt-1 text-2xl font-bold">{summary.upcomingPending}</p>
          </div>
        </div>
      </section>

      <section id="kalender" aria-label="Kalender booking" className="mt-8 scroll-mt-24">
        <h2 className="font-display text-lg font-bold">Kalender Booking</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Status hari dihitung dari booking confirmed + blokir + tanda penuh
          — sama seperti kalender publik.
        </p>
        {settingsReady ? (
          <AdminCalendar />
        ) : (
          <p className="mt-3 text-sm text-neutral-600">
            {loadError ?? "Menunggu pengaturan…"}
          </p>
        )}
      </section>

      <section id="booking" aria-label="Booking" className="mt-8 scroll-mt-24">
        <h2 className="font-display text-lg font-bold">Booking</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Catat hasil negosiasi WA — konfirmasi / batalkan untuk mengubah
          status hari di kalender publik.
        </p>
        <BookingsManager />
      </section>

      <section
        id="permintaan"
        aria-label="Permintaan booking"
        className="mt-8 scroll-mt-24"
      >
        <h2 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold">
          Permintaan
          {requestCount > 0 ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              {requestCount} perlu ditindak
            </span>
          ) : null}
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Kirim link Format Booking ke klien, lalu terima permintaan yang
          masuk menjadi booking lewat form yang sudah ada.
        </p>
        <RequestsManager onAttentionCountChange={setRequestCount} />
      </section>

      <section id="blokir" aria-label="Blokir dan tanggal penuh" className="mt-8 scroll-mt-24">
        <h2 className="font-display text-lg font-bold">Blokir &amp; Tanggal Penuh</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Tutup hari atau jam tertentu — bentrok dengan booking confirmed
          ditolak dengan pesan.
        </p>
        <BlocksManager />
      </section>

      <section id="portfolio" aria-label="Portfolio" className="mt-8 scroll-mt-24">
        <h2 className="font-display text-lg font-bold">Portfolio</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Karya tampil di landing — perubahan tersimpan langsung terbaca
          grid publik.
        </p>
        <PortfolioManager />
      </section>

      <section id="harga" aria-label="Harga dan layanan" className="mt-8 scroll-mt-24">
        <h2 className="font-display text-lg font-bold">Harga &amp; Layanan</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Daftar harga tampil di landing — perubahan tersimpan langsung
          terbaca kartu harga publik.
        </p>
        <ServicesManager />
      </section>

      <section id="profil-testimoni" aria-label="Profil dan testimoni" className="mt-8 scroll-mt-24">
        <h2 className="font-display text-lg font-bold">Profil &amp; Testimoni</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Profil dan review klien tampil di landing — perubahan tersimpan
          langsung terbaca blok hero publik.
        </p>
        <h3 className="mt-4 text-sm font-bold text-neutral-800">Profil</h3>
        <ProfileForm />
        <h3 className="mt-6 text-sm font-bold text-neutral-800">
          Stat pencapaian (maks 4 tampil di landing)
        </h3>
        <StatsManager />
        <h3 className="mt-6 text-sm font-bold text-neutral-800">Testimoni</h3>
        <TestimonialsManager />
      </section>

      <section id="pengaturan" aria-label="Pengaturan operasional" className="mt-8 scroll-mt-24">
        <h2 className="font-display text-lg font-bold">Pengaturan Operasional</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Nomor WA dipakai link WhatsApp. Kalender publik membaca jadwal
          langsung tanpa batasan jam operasional.
        </p>
        <form onSubmit={onSave} className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Nomor WhatsApp</span>
            <input
              type="tel"
              required
              disabled={!settingsReady}
              value={waNumber}
              onChange={(e) => setWaNumber(e.target.value)}
              placeholder="6281234567890"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          {formError ? (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          ) : null}
          {saved ? (
            <p role="status" className="text-sm text-green-700">
              Pengaturan tersimpan — kalender publik ikut terbaru.
            </p>
          ) : null}
          <button
            type="submit"
            disabled={saving || !settingsReady}
            className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
          >
            {saving ? "Menyimpan…" : "Simpan pengaturan"}
          </button>
        </form>
      </section>
    </main>
  );
}
