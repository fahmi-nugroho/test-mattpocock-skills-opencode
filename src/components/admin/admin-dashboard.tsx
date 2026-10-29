"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getTodayKey } from "@/lib/calendar";
import { ADMIN_TABS, parseAdminTab, type AdminTabId } from "@/lib/admin/admin-tabs";
import { summarizeBookings, type OverviewSummary } from "@/lib/admin/overview";
import { validateSettingsInput } from "@/lib/admin/validate-settings";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getOverviewBookings } from "@/lib/supabase/admin-overview";
import { SCHEDULE_CHANGED_EVENT } from "@/lib/admin/schedule-events";
import { getSettings, updateSettings } from "@/lib/supabase/admin-settings";
import {
  isMirrorStatusUnhealthy,
  type GoogleCalendarStatus,
} from "@/lib/google/connection-status";
import { AdminOverviewPanel } from "@/components/admin/admin-overview-panel";
import { PortfolioManager } from "@/components/admin/portfolio-manager";
import { ServicesManager } from "@/components/admin/services-manager";
import { ProfileForm } from "@/components/admin/profile-form";
import { StatsManager } from "@/components/admin/stats-manager";
import { TestimonialsManager } from "@/components/admin/testimonials-manager";
import { BookingsManager } from "@/components/admin/bookings-manager";
import { RequestsManager } from "@/components/admin/requests-manager";
import { BlocksManager } from "@/components/admin/blocks-manager";
import { AdminCalendar } from "@/components/admin/admin-calendar";
import { GoogleCalendarSettings } from "@/components/admin/google-calendar-settings";

const EMPTY_SUMMARY: OverviewSummary = {
  todayConfirmed: 0,
  todayPending: 0,
  upcomingConfirmed: 0,
  upcomingPending: 0,
};

/**
 * Guarded admin dashboard (ticket 05): browser-session guard redirects
 * to /admin/login without a session; authenticated reads use the same
 * browser client so the `authenticated` RLS policies apply. One panel shows
 * at a time — Ringkasan answers "what needs me now" (pending requests,
 * unconfirmed bookings, today/upcoming counts), the rest hold the booking,
 * content, and settings managers.
 */
export function AdminDashboard() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [summary, setSummary] = useState<OverviewSummary>(EMPTY_SUMMARY);
  const [requestCount, setRequestCount] = useState(0);
  const [googleStatus, setGoogleStatus] =
    useState<GoogleCalendarStatus | null>(null);
  const [waNumber, setWaNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settingsReady, setSettingsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Hash-driven tab state (no router): survives reload via
  // window.location.hash on mount, updates on hashchange (back/forward,
  // external links). Tab clicks push the hash themselves.
  const [activeTab, setActiveTab] = useState<AdminTabId>(() =>
    typeof window !== "undefined"
      ? parseAdminTab(window.location.hash)
      : "ringkasan",
  );
  const mobileNavRef = useRef<HTMLUListElement>(null);

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
        setBankName(settings.bank_name);
        setAccountName(settings.account_name);
        setAccountNumber(settings.account_number);
        setInstagramHandle(settings.instagram_handle);
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

  // Keep the active pill in view on the scrolling mobile tab strip, so a
  // deep link to a late tab (Pengaturan) does not land on a hidden label.
  useEffect(() => {
    const strip = mobileNavRef.current;
    if (!strip) return;
    // rAF: the strip mounts with the authenticated shell, so layout must be
    // settled before the active pill's offset means anything.
    const frame = requestAnimationFrame(() => {
      const active = strip.querySelector<HTMLElement>('[aria-current="page"]');
      if (!active) return;
      const stripRect = strip.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      strip.scrollLeft +=
        activeRect.left -
        stripRect.left -
        stripRect.width / 2 +
        activeRect.width / 2;
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, authed, loading]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settingsReady || saving) return;
    setFormError(null);
    setSaved(false);
    let validated;
    try {
      validated = validateSettingsInput({
        wa_number: waNumber,
        bank_name: bankName,
        account_name: accountName,
        account_number: accountNumber,
        instagram_handle: instagramHandle,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Input tidak valid");
      return;
    }
    setSaving(true);
    try {
      await updateSettings(supabaseBrowser(), validated);
      setWaNumber(validated.wa_number);
      setBankName(validated.bank_name);
      setAccountName(validated.account_name);
      setAccountNumber(validated.account_number);
      setInstagramHandle(validated.instagram_handle);
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
  /**
   * Tabs are views, not anchors: the panel is swapped in place and the hash
   * stays shareable. pushState (not location.hash) keeps the browser from
   * hunting for an element that is not rendered yet; hashchange still drives
   * back/forward, which the listener above already handles.
   */
  function openTab(tab: AdminTabId) {
    setActiveTab(tab);
    if (window.location.hash !== `#${tab}`) {
      window.history.pushState(null, "", `#${tab}`);
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  if (!authed || loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold">Dashboard Admin</h1>
        {loadError ? (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {loadError}
          </p>
        ) : (
          <>
            <p role="status" className="sr-only">
              Memuat dashboard…
            </p>
            <div aria-hidden="true" className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="h-28 animate-pulse rounded-xl border border-neutral-200 bg-white" />
              <div className="h-28 animate-pulse rounded-xl border border-neutral-200 bg-white" />
            </div>
          </>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">
      <header>
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-2xl font-bold">Dashboard Admin</h1>
          <button
            type="button"
            onClick={onSignOut}
            className="shrink-0 rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-semibold transition hover:bg-neutral-100"
          >
            Keluar
          </button>
        </div>
        <p className="mt-1 text-sm text-neutral-600">
          Jadwal, permintaan, dan konten landing.
        </p>
      </header>

      <nav
        aria-label="Navigasi dashboard"
        className="sticky top-0 z-20 -mx-4 mt-6 border-b border-neutral-200 bg-cream/95 px-4 backdrop-blur lg:hidden"
      >
        <ul ref={mobileNavRef} className="flex gap-1.5 overflow-x-auto py-2">
          {ADMIN_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <li key={tab.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => openTab(tab.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition ${
                    active
                      ? "border-gold-soft bg-gold-soft font-semibold text-gold-deep"
                      : "border-neutral-200 bg-white font-medium text-neutral-600 hover:border-neutral-300 hover:text-espresso"
                  }`}
                >
                  {tab.label}
                  {tab.id === "permintaan" && requestCount > 0 ? (
                    <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                      {requestCount}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="lg:mt-8 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-10">
        <nav
          aria-label="Navigasi dashboard"
          className="sticky top-6 hidden lg:block"
        >
          <ul className="space-y-0.5 rounded-xl border border-neutral-200 bg-white p-2">
            {ADMIN_TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <li key={tab.id}>
                  <button
                    type="button"
                    onClick={() => openTab(tab.id)}
                    aria-current={active ? "page" : undefined}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      active
                        ? "bg-gold-soft font-semibold text-gold-deep"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-espresso"
                    }`}
                  >
                    {tab.label}
                    {tab.id === "permintaan" && requestCount > 0 ? (
                      <span className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                        {requestCount}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-6 min-w-0 lg:mt-0">
          {isMirrorStatusUnhealthy(googleStatus) ? (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4"
            >
              <p className="text-sm font-semibold text-amber-900">
                Google Calendar tidak menerima pembaruan terbaru.
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Mirror aktif, tetapi pembaruan terakhir gagal
                {googleStatus?.connection.last_error
                  ? `: ${googleStatus.connection.last_error}`
                  : "."}{" "}
                Periksa koneksi di{" "}
                <button
                  type="button"
                  onClick={() => openTab("pengaturan")}
                  className="font-semibold underline underline-offset-2"
                >
                  Pengaturan
                </button>
                .
              </p>
            </div>
          ) : null}

          {loadError ? (
            <p
              role="alert"
              className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {loadError}
            </p>
          ) : null}

          <section
            id="ringkasan"
            aria-labelledby="ringkasan-title"
            hidden={activeTab !== "ringkasan"}
            className="scroll-mt-24"
          >
            <PanelHeading
              id="ringkasan-title"
              title="Ringkasan"
              description="Yang perlu ditindak, plus booking hari ini dan mendatang."
            />
            <div className="mt-5">
              <AdminOverviewPanel
                summary={summary}
                requestCount={requestCount}
                onOpenTab={openTab}
              />
            </div>
          </section>

          <section
            id="kalender"
            aria-labelledby="kalender-title"
            hidden={activeTab !== "kalender"}
            className="scroll-mt-24"
          >
            <PanelHeading
              id="kalender-title"
              title="Kalender Booking"
              description="Status hari dihitung dari booking confirmed + blokir + tanda penuh — sama seperti kalender publik."
            />
            {settingsReady ? (
              <AdminCalendar />
            ) : (
              <p className="mt-4 text-sm text-neutral-600">
                {loadError ?? "Menunggu pengaturan…"}
              </p>
            )}
          </section>

          <section
            id="booking"
            aria-labelledby="booking-title"
            hidden={activeTab !== "booking"}
            className="scroll-mt-24"
          >
            <PanelHeading
              id="booking-title"
              title="Booking"
              description="Catat hasil negosiasi WA — konfirmasi / batalkan untuk mengubah status hari di kalender publik."
            />
            <BookingsManager />
          </section>

          <section
            id="permintaan"
            aria-labelledby="permintaan-title"
            hidden={activeTab !== "permintaan"}
            className="scroll-mt-24"
          >
            <PanelHeading
              id="permintaan-title"
              title="Permintaan"
              description="Kirim link Format Booking ke klien, lalu terima permintaan yang masuk menjadi booking lewat form yang sudah ada."
            />
            <RequestsManager onAttentionCountChange={setRequestCount} />
          </section>

          <section
            id="blokir"
            aria-labelledby="blokir-title"
            hidden={activeTab !== "blokir"}
            className="scroll-mt-24"
          >
            <PanelHeading
              id="blokir-title"
              title="Blokir & Tanggal Penuh"
              description="Tutup hari atau jam tertentu — bentrok dengan booking confirmed ditolak dengan pesan."
            />
            <BlocksManager />
          </section>

          <section
            id="portfolio"
            aria-labelledby="portfolio-title"
            hidden={activeTab !== "portfolio"}
            className="scroll-mt-24"
          >
            <PanelHeading
              id="portfolio-title"
              title="Portfolio"
              description="Karya tampil di landing — perubahan tersimpan langsung terbaca grid publik."
            />
            <PortfolioManager />
          </section>

          <section
            id="harga"
            aria-labelledby="harga-title"
            hidden={activeTab !== "harga"}
            className="scroll-mt-24"
          >
            <PanelHeading
              id="harga-title"
              title="Harga & Layanan"
              description="Daftar harga tampil di landing — perubahan tersimpan langsung terbaca kartu harga publik."
            />
            <ServicesManager />
          </section>

          <section
            id="profil-testimoni"
            aria-labelledby="profil-testimoni-title"
            hidden={activeTab !== "profil-testimoni"}
            className="scroll-mt-24"
          >
            <PanelHeading
              id="profil-testimoni-title"
              title="Profil & Testimoni"
              description="Profil dan review klien tampil di landing — perubahan tersimpan langsung terbaca blok hero publik."
            />
            <h3 className="mt-6 text-sm font-bold text-neutral-800">Profil</h3>
            <ProfileForm />
            <h3 className="mt-8 text-sm font-bold text-neutral-800">
              Stat pencapaian (maks 4 tampil di landing)
            </h3>
            <StatsManager />
            <h3 className="mt-8 text-sm font-bold text-neutral-800">
              Testimoni
            </h3>
            <TestimonialsManager />
          </section>

          <section
            id="pengaturan"
            aria-labelledby="pengaturan-title"
            hidden={activeTab !== "pengaturan"}
            className="scroll-mt-24"
          >
            <PanelHeading
              id="pengaturan-title"
              title="Pengaturan Operasional"
              description="Nomor WA dipakai link WhatsApp. Data bank dan Instagram dicetak di invoice. Kalender publik membaca jadwal langsung tanpa batasan jam operasional."
            />
            <form
              onSubmit={onSave}
              className="mt-4 space-y-4 rounded-xl border border-neutral-200 bg-white p-5"
            >
              <h3 className="text-sm font-bold">Kontak &amp; pembayaran</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">Nomor WhatsApp</span>
                  <input
                    type="tel"
                    required
                    disabled={!settingsReady}
                    value={waNumber}
                    onChange={(e) => setWaNumber(e.target.value)}
                    placeholder="6281234567890"
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Instagram</span>
                  <input
                    type="text"
                    disabled={!settingsReady}
                    value={instagramHandle}
                    onChange={(e) => setInstagramHandle(e.target.value)}
                    placeholder="wandanamakeup"
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Nama Bank</span>
                  <input
                    type="text"
                    disabled={!settingsReady}
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="BCA"
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">
                    Nama Pemilik Rekening
                  </span>
                  <input
                    type="text"
                    disabled={!settingsReady}
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Nama pemilik rekening"
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Nomor Rekening</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={!settingsReady}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="1234567890"
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
                  />
                </label>
              </div>
              <p className="text-xs text-neutral-500">
                Bank, nama pemilik, nomor rekening, dan Instagram boleh
                dikosongkan — invoice mencetak tanda — pada bagian yang kosong.
              </p>
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
              <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-4">
                <button
                  type="submit"
                  disabled={saving || !settingsReady}
                  className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
                >
                  {saving ? "Menyimpan…" : "Simpan pengaturan"}
                </button>
              </div>
            </form>

            <GoogleCalendarSettings onStatusChange={setGoogleStatus} />
          </section>
        </div>
      </div>
    </main>
  );
}

function PanelHeading({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 id={id} className="font-display text-xl font-bold">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-neutral-600">{description}</p>
    </div>
  );
}
