"use client";

import { useEffect, useMemo, useState } from "react";
import type { DayStatus } from "@/lib/availability";
import {
  WEEKDAY_HEADERS_ID,
  formatMonthId,
  getMonthCells,
  getTodayKey,
  isPastDate,
  parseMonthKey,
  shiftMonth,
  toMonthKey,
} from "@/lib/calendar";
import {
  getMonthAvailability,
  type RpcClient,
} from "@/lib/month-availability";
import { supabaseBrowser } from "@/lib/supabase/client";
import { buildGeneralWaLink } from "@/lib/whatsapp";

const STATUS_META: Record<
  DayStatus,
  { label: string; swatch: string; cell: string }
> = {
  available: {
    label: "Tersedia",
    swatch: "bg-green-500",
    cell: "bg-green-100 text-green-900",
  },
  fully_booked: {
    label: "Penuh",
    swatch: "bg-amber-500",
    cell: "bg-amber-200 text-amber-900",
  },
  blocked: {
    label: "Tutup",
    swatch: "bg-red-400",
    cell: "bg-red-100 text-red-900",
  },
};

const UNKNOWN_CELL = "bg-neutral-50 text-neutral-400";

/**
 * Read-only public month calendar. Day colours come from the
 * `get_month_availability` RPC (date+status only, no client PII) whose
 * SQL mirrors `computeDayStatus`; the pure function itself can't run
 * client-side because its bookings/blocks inputs would leak PII.
 *
 * Partial-occupancy dots: the RPC intentionally hides occupancy counts,
 * so the public wiring passes no `partialDates` (all available days
 * render uniformly). The prop exists for future non-PII previews
 * without changing the RPC contract.
 */
export function AvailabilityCalendar({
  waNumber,
  initialMonth,
  partialDates,
}: {
  waNumber: string;
  initialMonth?: string;
  partialDates?: readonly string[];
}) {
  const [monthKey, setMonthKey] = useState(() => {
    if (initialMonth) return initialMonth;
    const now = new Date();
    return toMonthKey(now.getFullYear(), now.getMonth() + 1);
  });
  const [statusByDate, setStatusByDate] = useState<Record<string, DayStatus>>(
    {},
  );
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const todayKey = useMemo(() => getTodayKey(), []);
  const partialSet = useMemo(
    () => new Set(partialDates ?? []),
    [partialDates],
  );

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setError(null);
    getMonthAvailability(
      supabaseBrowser() as unknown as RpcClient,
      monthKey,
    ).then(
      (rows) => {
        if (cancelled) return;
        const map: Record<string, DayStatus> = {};
        for (const row of rows) map[row.date] = row.status;
        setStatusByDate(map);
        setLoaded(true);
      },
      () => {
        if (cancelled) return;
        setError("Gagal memuat jadwal. Periksa koneksi lalu coba lagi.");
        setLoaded(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [monthKey, attempt]);

  const { year, month } = parseMonthKey(monthKey);
  const cells = useMemo(() => getMonthCells(year, month), [year, month]);
  const monthLabel = formatMonthId(monthKey);
  const empty = loaded && !error && Object.keys(statusByDate).length === 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonthKey((m) => shiftMonth(m, -1))}
          aria-label="Bulan sebelumnya"
          className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-semibold transition hover:bg-neutral-100"
        >
          ‹
        </button>
        <p aria-live="polite" className="text-base font-bold">
          {monthLabel}
        </p>
        <button
          type="button"
          onClick={() => setMonthKey((m) => shiftMonth(m, 1))}
          aria-label="Bulan berikutnya"
          className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-semibold transition hover:bg-neutral-100"
        >
          ›
        </button>
      </div>

      {!loaded && !error ? (
        <div aria-busy="true" className="mt-4">
          <p className="text-sm text-neutral-600">Memuat jadwal…</p>
          <div className="mt-2 grid grid-cols-7 gap-1" aria-hidden="true">
            {cells.map((cell, i) => (
              <div
                key={cell ?? `blank-${i}`}
                className="aspect-square animate-pulse rounded-lg bg-neutral-100"
              />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 text-center">
          <p className="text-sm text-neutral-600">{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="mt-3 rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700"
          >
            Coba lagi
          </button>
        </div>
      ) : empty ? (
        <p className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 text-center text-sm text-neutral-600">
          Jadwal bulan ini belum tersedia — tanyakan langsung via WhatsApp
          untuk info terbaru.
        </p>
      ) : (
        <div className="mt-4">
          <div
            className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-neutral-500"
            aria-hidden="true"
          >
            {WEEKDAY_HEADERS_ID.map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((date, i) => {
              if (date === null) return <div key={`blank-${i}`} />;
              const status = statusByDate[date];
              const past = isPastDate(date, todayKey);
              const dayNum = Number(date.slice(8, 10));
              const label = status ? STATUS_META[status].label : "Belum ada info";
              const showDot =
                status === "available" && !past && partialSet.has(date);
              // Past dates keep their status hue but muted, so the
              // 3-color signal survives greying.
              const cell = status ? STATUS_META[status].cell : UNKNOWN_CELL;
              const ariaLabel = `${dayNum} ${monthLabel}: ${label}${past ? " (lewat)" : ""}`;
              return (
                <div
                  key={date}
                  title={ariaLabel}
                  aria-label={ariaLabel}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm font-medium ${cell}${past ? " opacity-60 saturate-50" : ""}`}
                >
                  <span>{dayNum}</span>
                  {showDot ? (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-1 h-1 w-1 rounded-full bg-green-700"
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
            {(Object.keys(STATUS_META) as DayStatus[]).map((status) => (
              <li key={status} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`h-3 w-3 rounded ${STATUS_META[status].swatch}`}
                />
                {STATUS_META[status].label}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-3 w-3 rounded bg-neutral-200"
              />
              Tanggal lalu
            </li>
          </ul>
        </div>
      )}

      <a
        href={buildGeneralWaLink(waNumber)}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-block rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-semibold transition hover:bg-neutral-100"
      >
        Tanya Jadwal via WhatsApp
      </a>
    </div>
  );
}
