"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getTodayKey } from "@/lib/calendar";
import { summarizeBookings, type OverviewSummary } from "@/lib/admin/overview";
import { validateSettingsInput } from "@/lib/admin/validate-settings";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getOverviewBookings } from "@/lib/supabase/admin-overview";
import { getSettings, updateSettings } from "@/lib/supabase/admin-settings";
import { PortfolioManager } from "@/components/admin/portfolio-manager";
import { ServicesManager } from "@/components/admin/services-manager";
import { BookingsManager } from "@/components/admin/bookings-manager";
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
 * today/upcoming booking counts plus the operating-settings form whose
 * saves are read live by the public month RPC (calendar derivation).
 */
export default function AdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [summary, setSummary] = useState<OverviewSummary>(EMPTY_SUMMARY);
  const [waNumber, setWaNumber] = useState("");
  const [openHour, setOpenHour] = useState("09:00");
  const [closeHour, setCloseHour] = useState("19:00");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settingsReady, setSettingsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
        setOpenHour(settings.open_hour);
        setCloseHour(settings.close_hour);
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

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settingsReady || saving) return;
    setFormError(null);
    setSaved(false);
    let validated;
    try {
      validated = validateSettingsInput({
        wa_number: waNumber,
        open_hour: openHour,
        close_hour: closeHour,
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
      <main className="mx-auto max-w-2xl px-4 py-20">
        <p className="text-center text-sm text-neutral-600">
          {loadError ?? "Memuat dashboard…"}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard Admin</h1>
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-semibold transition hover:bg-neutral-100"
        >
          Keluar
        </button>
      </div>

      {loadError ? (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {loadError}
        </p>
      ) : null}

      <section aria-label="Ringkasan booking" className="mt-6">
        <h2 className="text-lg font-bold">Ringkasan Booking</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
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

      <section aria-label="Kalender booking" className="mt-8">
        <h2 className="text-lg font-bold">Kalender Booking</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Status hari dihitung dari booking confirmed + blokir + tanda penuh
          — sama seperti kalender publik.
        </p>
        {settingsReady ? (
          <AdminCalendar openHour={openHour} closeHour={closeHour} />
        ) : (
          <p className="mt-3 text-sm text-neutral-600">
            {loadError ?? "Menunggu pengaturan jam…"}
          </p>
        )}
      </section>

      <section aria-label="Booking" className="mt-8">
        <h2 className="text-lg font-bold">Booking</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Catat hasil negosiasi WA — konfirmasi / batalkan untuk mengubah
          status hari di kalender publik.
        </p>
        <BookingsManager />
      </section>

      <section aria-label="Blokir dan tanggal penuh" className="mt-8">
        <h2 className="text-lg font-bold">Blokir &amp; Tanggal Penuh</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Tutup hari atau jam tertentu — bentrok dengan booking confirmed
          ditolak dengan pesan.
        </p>
        <BlocksManager />
      </section>

      <section aria-label="Portfolio" className="mt-8">
        <h2 className="text-lg font-bold">Portfolio</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Karya tampil di landing — perubahan tersimpan langsung terbaca
          grid publik.
        </p>
        <PortfolioManager />
      </section>

      <section aria-label="Harga dan layanan" className="mt-8">
        <h2 className="text-lg font-bold">Harga &amp; Layanan</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Daftar harga tampil di landing — perubahan tersimpan langsung
          terbaca kartu harga publik.
        </p>
        <ServicesManager />
      </section>

      <section aria-label="Pengaturan operasional" className="mt-8">
        <h2 className="text-lg font-bold">Pengaturan Operasional</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Nomor WA dan jam dipakai link WhatsApp dan kalender publik.
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
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium">Jam buka</span>
              <input
                type="time"
                required
                disabled={!settingsReady}
                value={openHour}
                onChange={(e) => setOpenHour(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Jam tutup</span>
              <input
                type="time"
                required
                disabled={!settingsReady}
                value={closeHour}
                onChange={(e) => setCloseHour(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
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
