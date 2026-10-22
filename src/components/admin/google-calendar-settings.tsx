"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTimeId } from "@/lib/format";
import {
  isMirrorStatusUnhealthy,
  type GoogleCalendarStatus,
} from "@/lib/google/connection-status";
import { supabaseBrowser } from "@/lib/supabase/client";

type Action = "test" | "connect" | "disconnect";

interface Notice {
  kind: "success" | "error";
  text: string;
}

interface Props {
  onStatusChange?: (status: GoogleCalendarStatus | null) => void;
}

async function adminRequest(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const { data } = await supabaseBrowser().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sesi admin berakhir. Masuk kembali.");
  return fetch(input, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

function StatusFact({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

/**
 * Google Calendar section in Pengaturan (ticket 01). Reads the connection
 * through an authenticated admin route, runs the same access probe as
 * "Tes koneksi", enables only after that probe succeeds, and disconnects
 * without touching Google. All copy is Indonesian; no credential reaches
 * this component.
 */
export function GoogleCalendarSettings({ onStatusChange }: Props) {
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await adminRequest("/api/admin/google-calendar");
      const body = (await response.json().catch(() => ({}))) as {
        status?: GoogleCalendarStatus;
        error?: string;
      };
      if (!response.ok || !body.status) {
        throw new Error(body.error ?? "Gagal memuat status Kalender Google.");
      }
      setStatus(body.status);
      onStatusChange?.(body.status);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Gagal memuat status Kalender Google.",
      );
      onStatusChange?.(null);
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    void load();
  }, [load]);

  async function performAction(action: Action) {
    if (busy) return;
    setBusy(action);
    setNotice(null);
    try {
      const response = await adminRequest("/api/admin/google-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string | null;
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Permintaan Kalender Google gagal.");
      }
      if (action === "disconnect") {
        setNotice({
          kind: "success",
          text: "Kalender Google diputuskan. Mirror berhenti dan event yang sudah ada dibiarkan.",
        });
      } else if (body.ok && action === "test") {
        setNotice({
          kind: "success",
          text: "Tes berhasil: kalender dapat dibaca dan ditulis.",
        });
      } else if (body.ok) {
        setNotice({
          kind: "success",
          text: "Kalender Google terhubung. Mirror aktif.",
        });
      } else {
        setNotice({
          kind: "error",
          text: body.error ?? "Tes koneksi gagal. Periksa kembali pengaturan Google.",
        });
      }
      await load();
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Permintaan Kalender Google gagal.",
      });
    } finally {
      setBusy(null);
    }
  }

  const connection = status?.connection ?? null;
  const unhealthy = isMirrorStatusUnhealthy(status);

  return (
    <div
      id="google-calendar"
      className="mt-10 scroll-mt-24 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-bold">Google Calendar</h3>
        {connection ? (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              connection.enabled
                ? "bg-green-100 text-green-800"
                : "bg-neutral-200 text-neutral-700"
            }`}
          >
            {connection.enabled ? "Mirror aktif" : "Mirror nonaktif"}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-neutral-600">
        Booking terkonfirmasi dicerminkan satu arah ke kalender Google
        &quot;MUA — Booking&quot;. Kalender publik, Blokir, dan data klien di
        dashboard tidak berubah karena fitur ini.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-neutral-600">Memuat status…</p>
      ) : loadError ? (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {loadError}
        </p>
      ) : status && connection ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatusFact
              label="Konfigurasi server"
              value={
                status.configured ? (
                  <span className="text-green-700">Siap</span>
                ) : (
                  <span className="text-red-700">Belum lengkap</span>
                )
              }
            />
            <StatusFact
              label="Mirror"
              value={connection.enabled ? "Aktif" : "Nonaktif"}
            />
            <StatusFact
              label="Terakhir diverifikasi"
              value={
                connection.last_verified_at
                  ? formatDateTimeId(connection.last_verified_at)
                  : "Belum pernah"
              }
            />
            <StatusFact
              label="Error terakhir"
              value={
                connection.last_error ? (
                  <span className="text-red-700">{connection.last_error}</span>
                ) : (
                  "Tidak ada"
                )
              }
            />
          </div>

          {!status.configured && status.configError ? (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {status.configError}
            </p>
          ) : null}

          {unhealthy ? (
            <p role="alert" className="mt-3 rounded-lg bg-amber-100 p-3 text-sm text-amber-900">
              Mirror aktif tetapi Google belum menerima pembaruan terbaru.
              Perbaiki error di atas lalu jalankan &quot;Tes koneksi&quot;.
            </p>
          ) : null}

          {connection.calendar_id ? (
            <p className="mt-3 break-all text-xs text-neutral-500">
              Kalender tersambung: {connection.calendar_id}
            </p>
          ) : null}
        </>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void performAction("test")}
          disabled={busy !== null || !status?.configured}
          className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold transition hover:bg-neutral-100 disabled:opacity-60"
        >
          {busy === "test" ? "Menguji…" : "Tes koneksi"}
        </button>
        <button
          type="button"
          onClick={() => void performAction("connect")}
          disabled={
            busy !== null || !status?.configured || status.connection.enabled
          }
          className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
        >
          {busy === "connect" ? "Menghubungkan…" : "Hubungkan"}
        </button>
        <button
          type="button"
          onClick={() => void performAction("disconnect")}
          disabled={busy !== null || !status?.connection.enabled}
          className="rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
        >
          {busy === "disconnect" ? "Memutuskan…" : "Putuskan"}
        </button>
      </div>

      {notice ? (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={`mt-3 text-sm ${
            notice.kind === "error" ? "text-red-600" : "text-green-700"
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      <details className="mt-5 rounded-lg border border-neutral-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold">
          Panduan menyiapkan Google Calendar (sekali saja)
        </summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-neutral-700">
          <li>
            Buat project di Google Cloud Console, lalu aktifkan{" "}
            <strong>Google Calendar API</strong>.
          </li>
          <li>
            Buat <strong>service account</strong> dan unduh kunci JSON-nya.
          </li>
          <li>
            Buat kalender sekunder bernama <strong>MUA — Booking</strong>, lalu
            bagikan ke alamat email service account dengan akses{" "}
            <strong>Make changes to events</strong>. Akses baca saja akan
            ditolak oleh Tes koneksi.
          </li>
          <li>
            Isi nilai server-only:{" "}
            <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code>,{" "}
            <code>GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code>,{" "}
            <code>GOOGLE_CALENDAR_ID</code>, dan{" "}
            <code>GOOGLE_CALENDAR_CRON_SECRET</code>. Jangan pernah memakai
            awalan <code>NEXT_PUBLIC_</code>.
          </li>
          <li>
            Tekan <strong>Tes koneksi</strong>, lalu <strong>Hubungkan</strong>.
            Mengganti kredensial cukup dengan mengganti nilai server dan
            men-deploy ulang.
          </li>
        </ol>
      </details>
    </div>
  );
}
