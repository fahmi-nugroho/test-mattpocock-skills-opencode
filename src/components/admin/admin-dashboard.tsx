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
  const [summary, setSummary] = useState<OverviewSummary | null>(null);
  const [requestCount, setRequestCount] = useState<number | null>();
  const [googleStatus, setGoogleStatus] =
    useState<GoogleCalendarStatus | null>(null);
  const [waNumber, setWaNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [overviewError, setOverviewError] = useState(false);
  const [overviewAttempt, setOverviewAttempt] = useState(0);
  const [settingsError, setSettingsError] = useState(false);
  const [settingsAttempt, setSettingsAttempt] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Hash-driven tab state (no router): survives reload via
  // window.location.hash on mount, updates on hashchange (back/forward,
  // external links). Tab clicks push the hash themselves.
  const [dashboardHash, setDashboardHash] = useState(() =>
    typeof window !== "undefined" ? window.location.hash : "",
  );
  const activeTab = parseAdminTab(dashboardHash);

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
    let latestLoad = 0;
    async function loadOverview() {
      const load = ++latestLoad;
      setOverviewError(false);
      try {
        const today = getTodayKey();
        const bookings = await getOverviewBookings(supabaseBrowser(), today);
        if (load === latestLoad) setSummary(summarizeBookings(bookings, today));
      } catch {
        if (load === latestLoad) setOverviewError(true);
      }
    }
    void loadOverview();
    window.addEventListener(SCHEDULE_CHANGED_EVENT, loadOverview);
    return () => {
      latestLoad += 1;
      window.removeEventListener(SCHEDULE_CHANGED_EVENT, loadOverview);
    };
  }, [authed, overviewAttempt]);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    setSettingsError(false);
    (async () => {
      try {
        const settings = await getSettings(supabaseBrowser());
        if (cancelled) return;
        setWaNumber(settings.wa_number);
        setBankName(settings.bank_name);
        setAccountName(settings.account_name);
        setAccountNumber(settings.account_number);
        setInstagramHandle(settings.instagram_handle);
        setSettingsReady(true);
      } catch {
        if (!cancelled) setSettingsError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authed, settingsAttempt]);

  useEffect(() => {
    const onHashChange = () => setDashboardHash(window.location.hash);
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
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(false);
    try {
      const { error } = await supabaseBrowser().auth.signOut();
      if (error) throw error;
      router.replace("/admin/login");
    } catch {
      setSigningOut(false);
      setSignOutError(true);
    }
  }
  /**
   * Tabs are views, not anchors: the panel is swapped in place and the hash
   * stays shareable. pushState (not location.hash) keeps the browser from
   * hunting for an element that is not rendered yet; hashchange still drives
   * back/forward, which the listener above already handles.
   */
  function openTab(tab: AdminTabId, query = "", focusId?: string) {
    const hash = `#${tab}${query}`;
    setDashboardHash(hash);
    if (window.location.hash !== hash) {
      window.history.pushState(null, "", hash);
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    if (focusId) {
      requestAnimationFrame(() => {
        const target = document.getElementById(focusId);
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ block: "start", behavior: "instant" });
      });
    }
  }

  if (!authed) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">
        <h1 className="font-display text-2xl font-bold">Dashboard Admin</h1>
        <p role="status" className="mt-4 text-sm text-neutral-600">Memeriksa sesi admin…</p>
      </main>
    );
  }

  return (
    <main data-admin-dashboard className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">
      <header>
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-2xl font-bold">Dashboard Admin</h1>
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="min-h-10 shrink-0 rounded-full border border-neutral-300 px-4 text-sm font-semibold transition hover:bg-neutral-100 disabled:opacity-60"
          >
            {signingOut ? "Keluar…" : "Keluar"}
          </button>
        </div>
        {signOutError ? (
          <p role="alert" className="mt-2 text-right text-sm text-red-700">Gagal keluar. Coba lagi.</p>
        ) : null}
      </header>

      <nav
        aria-label="Navigasi dashboard"
        className="sticky top-0 z-20 -mx-4 mt-4 border-b border-neutral-200 bg-cream px-4 py-3 sm:-mx-6 sm:px-6 lg:hidden"
      >
        <label className="flex items-center gap-3 text-sm font-medium">
          Bagian
          <select
            value={activeTab}
            onChange={(event) => openTab(parseAdminTab(event.target.value))}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold"
          >
            {ADMIN_TABS.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.label}{tab.id === "permintaan" && (requestCount ?? 0) > 0 ? ` (${requestCount} baru)` : ""}
              </option>
            ))}
          </select>
        </label>
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
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? "bg-gold-soft font-semibold text-gold-deep"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-espresso"
                    }`}
                  >
                    {tab.label}
                    {tab.id === "permintaan" && (requestCount ?? 0) > 0 ? (
                      <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
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

          <section
            id="ringkasan"
            aria-labelledby="ringkasan-title"
            hidden={activeTab !== "ringkasan"}
            className="scroll-mt-24"
          >
            <PanelHeading
              id="ringkasan-title"
              title="Ringkasan"
              description="Tinjau pekerjaan yang menunggu dan jadwal booking terdekat."
            />
            <div className="mt-5">
              <AdminOverviewPanel
                summary={summary}
                requestCount={requestCount}
                onOpenTab={openTab}
                onRetryBookings={overviewError ? () => setOverviewAttempt((attempt) => attempt + 1) : undefined}
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
              description="Pilih tanggal untuk melihat booking, jam yang diblokir, dan status di kalender publik."
            />
            <AdminCalendar onOpenBookings={(date) => openTab("booking", `?date=${date}`, "booking-queue-title")} />
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
              description="Kelola jadwal, status, dan invoice, atau catat booking dari WhatsApp."
            />
            <BookingsManager queueHash={activeTab === "booking" ? dashboardHash : null} />
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
              description="Tinjau formulir dari klien dan buat link Format Booking baru."
            />
            <RequestsManager
              queueHash={activeTab === "permintaan" ? dashboardHash : null}
              onOpenBookingDraft={() => openTab("booking", "", "booking-form")}
              onAttentionCountChange={setRequestCount}
            />
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
              description="Tutup satu hari atau jam tertentu di kalender publik."
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
              description="Atur karya, kategori, dan urutan di portfolio publik."
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
              description="Atur harga, durasi, dan layanan yang ditampilkan di situs."
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
              description="Kelola profil, pencapaian, dan ulasan klien di halaman publik."
            />
            <ProfileForm />
            <div className="mt-8 border-t border-neutral-200 pt-5">
              <h3 className="text-base font-bold">Pencapaian</h3>
              <p className="mt-1 text-sm text-neutral-600">Hingga 4 pencapaian tampil di halaman publik.</p>
              <StatsManager />
            </div>
            <div className="mt-8 border-t border-neutral-200 pt-5">
              <h3 className="text-base font-bold">Testimoni</h3>
              <TestimonialsManager />
            </div>
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
              description="Kelola kontak bisnis, detail yang tercetak di invoice, dan sinkronisasi kalender."
            />
            <form
              onSubmit={onSave}
              onChange={() => {
                setSaved(false);
                setFormError(null);
              }}
              className="mt-4 space-y-4 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5"
            >
              <h3 className="text-base font-bold">Kontak &amp; pembayaran</h3>
              {settingsError ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p role="alert" className="text-sm text-red-700">Pengaturan gagal dimuat.</p>
                  <button
                    type="button"
                    onClick={() => setSettingsAttempt((attempt) => attempt + 1)}
                    className="min-h-10 rounded-full border border-neutral-300 px-4 text-sm font-semibold hover:bg-neutral-100"
                  >
                    Muat ulang
                  </button>
                </div>
              ) : !settingsReady ? (
                <p role="status" className="text-sm text-neutral-600">Memuat pengaturan…</p>
              ) : (
                <fieldset disabled={saving} className="min-w-0 space-y-5 disabled:opacity-70">
                  <legend className="sr-only">Kontak &amp; pembayaran</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block min-w-0">
                      <span className="text-sm font-medium">Nomor WhatsApp</span>
                      <input
                        type="tel"
                        required
                        autoComplete="tel"
                        aria-describedby="admin-whatsapp-hint"
                        value={waNumber}
                        onChange={(e) => setWaNumber(e.target.value)}
                        placeholder="6281234567890"
                        className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                      />
                      <span id="admin-whatsapp-hint" className="mt-1 block text-xs text-neutral-600">
                        Pakai kode negara, misalnya 62 untuk Indonesia.
                      </span>
                    </label>
                    <label className="block min-w-0">
                      <span className="text-sm font-medium">Instagram (opsional)</span>
                      <input
                        type="text"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={instagramHandle}
                        onChange={(e) => setInstagramHandle(e.target.value)}
                        placeholder="@wandanamakeup"
                        className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                      />
                    </label>
                  </div>
                  <fieldset className="min-w-0 border-t border-neutral-200 pt-3">
                    <legend className="pr-2 text-sm font-semibold">Rekening untuk invoice</legend>
                    <p className="mb-3 text-xs text-neutral-600">Detail rekening boleh dikosongkan.</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block min-w-0">
                        <span className="text-sm font-medium">Nama bank</span>
                        <input
                          type="text"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          placeholder="BCA"
                          className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                        />
                      </label>
                      <label className="block min-w-0">
                        <span className="text-sm font-medium">Nomor rekening</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          placeholder="1234567890"
                          className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                        />
                      </label>
                      <label className="block min-w-0 sm:col-span-2">
                        <span className="text-sm font-medium">Nama pemilik rekening</span>
                        <input
                          type="text"
                          value={accountName}
                          onChange={(e) => setAccountName(e.target.value)}
                          placeholder="Nama sesuai rekening"
                          className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm"
                        />
                      </label>
                    </div>
                  </fieldset>
                </fieldset>
              )}
              {settingsReady ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4">
                  <div>
                    {formError ? <p role="alert" className="text-sm text-red-700">{formError}</p> : null}
                    {saved ? <p role="status" className="text-sm text-green-800">Pengaturan tersimpan.</p> : null}
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="ml-auto min-h-11 rounded-full bg-neutral-900 px-5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
                  >
                    {saving ? "Menyimpan…" : "Simpan pengaturan"}
                  </button>
                </div>
              ) : null}
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
