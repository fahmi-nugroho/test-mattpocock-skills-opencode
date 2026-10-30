"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { getDaySchedule, mergeOccupied, type DaySchedule } from "@/lib/day-schedule";
import { supabaseBrowser } from "@/lib/supabase/client";
import { validatePickerRange } from "@/lib/time-picker";
import {
  buildDateTimeWaLink,
  buildDateWaLink,
  buildGeneralWaLink,
} from "@/lib/whatsapp";

const STATUS_META: Record<
  DayStatus,
  { label: string; swatch: string; cell: string }
> = {
  // Warm-tinted shades within the green/amber/red families: lime-100 and
  // orange-100 lean warm (yellow/earth undertone) while the deep
  // green/amber/red text keeps the Tersedia/Penuh/Tutup signal readable.
  // The stone inset ring adds a warm tinge and lifts cells off the cream
  // page. Labels, derivation, and RPC contracts are untouched.
  available: {
    label: "Tersedia",
    swatch: "bg-lime-600",
    cell: "bg-lime-100 text-green-900 ring-1 ring-inset ring-stone-900/5",
  },
  // DEAD CODE (hours-removal contract): fully_booked is unreachable —
  // coverage derivation was removed with the operating window, so no
  // RPC or derivation resolves to this status. Kept so the legend can
  // be revived with the status itself (see docs/adr/0001-hours-removal.md).
  fully_booked: {
    label: "Penuh",
    swatch: "bg-amber-600",
    cell: "bg-amber-100 text-amber-900 ring-1 ring-inset ring-stone-900/5",
  },
  blocked: {
    label: "Tutup",
    swatch: "bg-red-500",
    cell: "bg-orange-100 text-red-900 ring-1 ring-inset ring-stone-900/5",
  },
};

const UNKNOWN_CELL = "bg-stone-50 text-stone-400";

const SELECTED_RING = " ring-2 ring-gold-deep ring-offset-2 ring-offset-cream";

const OCCUPIED_META = {
  booked: {
    label: "Terisi",
    row: "bg-amber-100 text-amber-900 ring-1 ring-inset ring-stone-900/5",
  },
  blocked: {
    label: "Tutup",
    row: "bg-orange-100 text-red-900 ring-1 ring-inset ring-stone-900/5",
  },
} as const;

/** Render a "YYYY-MM-DD" key as an Indonesian day label, e.g. "15 Oktober 2026". */
function formatDayId(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

/**
 * Read-only public month calendar with per-day detail. Day colours come
 * from the `get_month_availability` RPC (date+status only, no client PII)
 * whose SQL mirrors `computeDayStatus`; the pure function itself can't run
 * client-side because its bookings/blocks inputs would leak PII.
 *
 * Tapping a today/future day opens a modal popup over the calendar
 * showing `get_day_schedule` for that date (status + all-day flag +
 * occupied Terisi/Tutup ranges; times+kind only, no PII/hours).
 * Free gaps are still fetched but intentionally not displayed — clients
 * propose a time via the popup's time picker, validated live against
 * the shown occupied ranges and prefilled into the WhatsApp message.
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detail, setDetail] = useState<DaySchedule | null>(null);
  const [detailLoaded, setDetailLoaded] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailAttempt, setDetailAttempt] = useState(0);
  // Time-picker proposal for the date+time chat action. Empty means no
  // selection yet (hint state); cleared whenever the popup closes or a
  // new date is tapped so no stale proposal lingers.
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  // Invoking date button for focus return after the popup closes.
  const invokerRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (selectedDate === null) return;
    let cancelled = false;
    setDetail(null);
    setDetailLoaded(false);
    setDetailError(null);
    getDaySchedule(
      supabaseBrowser() as unknown as RpcClient,
      selectedDate,
    ).then(
      (row) => {
        if (cancelled) return;
        setDetail(row);
        setDetailLoaded(true);
      },
      () => {
        if (cancelled) return;
        setDetailError("Gagal memuat detail jadwal. Coba lagi.");
        setDetailLoaded(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selectedDate, detailAttempt]);

  const popupOpen = selectedDate !== null;

  function closePopup(): void {
    setSelectedDate(null);
    setDetail(null);
    setDetailLoaded(false);
    setDetailError(null);
    setStartTime("");
    setEndTime("");
  }

  // Popup chrome: Escape dismisses, background scrolling locks, and
  // focus returns to the invoking date button on close.
  useEffect(() => {
    if (!popupOpen) return;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") closePopup();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
      const invoker = invokerRef.current;
      if (invoker) {
        invokerRef.current = null;
        requestAnimationFrame(() => {
          document
            .querySelector<HTMLElement>(`[data-date="${invoker}"]`)
            ?.focus();
        });
      }
    };
  }, [popupOpen]);

  const { year, month } = parseMonthKey(monthKey);
  const cells = useMemo(() => getMonthCells(year, month), [year, month]);
  const monthLabel = formatMonthId(monthKey);
  const headerStatus: DayStatus | undefined =
    detail?.status ??
    (selectedDate !== null ? statusByDate[selectedDate] : undefined);
  const empty = loaded && !error && Object.keys(statusByDate).length === 0;
  const isClosedDetail =
    detail !== null && (detail.status === "blocked" || detail.allDayBlocked);
  const mergedOccupied = useMemo(
    () => (isClosedDetail ? [] : mergeOccupied(detail?.occupied ?? [])),
    [detail],
  );
  // Picker verdict against the shown ranges (half-open: touching edges
  // allowed). Only meaningful on bookable days; full and closed-all-day
  // popups render no picker and no date chat action at all.
  const pickerVerdict = useMemo(
    () => validatePickerRange(startTime, endTime, mergedOccupied),
    [startTime, endTime, mergedOccupied],
  );
  const isBookableDetail =
    detail !== null &&
    !isClosedDetail &&
    detail.status !== "fully_booked";

  function shiftMonthClearingSelection(delta: number): void {
    closePopup();
    setMonthKey((m) => shiftMonth(m, delta));
  }

  function handleDateTap(date: string): void {
    if (selectedDate === date) {
      closePopup();
      return;
    }
    invokerRef.current = date;
    // Fresh state per tap so no stale day detail lingers.
    setDetail(null);
    setDetailLoaded(false);
    setDetailError(null);
    setStartTime("");
    setEndTime("");
    setSelectedDate(date);
  }

  return (
    // Capped width: a full-width 7-column month at desktop sizes made
    // ~100px day cells. Phones are narrower than the cap, so unchanged.
    <div className="max-w-md">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonthClearingSelection(-1)}
          aria-label="Bulan sebelumnya"
          className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-semibold transition hover:bg-stone-100"
        >
          ‹
        </button>
        <p aria-live="polite" className="text-base font-bold">
          {monthLabel}
        </p>
        <button
          type="button"
          onClick={() => shiftMonthClearingSelection(1)}
          aria-label="Bulan berikutnya"
          className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-semibold transition hover:bg-stone-100"
        >
          ›
        </button>
      </div>

      {!loaded && !error ? (
        <div aria-busy="true" className="mt-4">
          <p className="text-sm text-stone-600">Memuat jadwal…</p>
          <div className="mt-2 grid grid-cols-7 gap-1" aria-hidden="true">
            {cells.map((cell, i) => (
              <div
                key={cell ?? `blank-${i}`}
                className="aspect-square animate-pulse rounded-lg bg-stone-100"
              />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4 text-center">
          <p className="text-sm text-stone-600">{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="mt-3 rounded-full bg-stone-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-stone-700"
          >
            Coba lagi
          </button>
        </div>
      ) : empty ? (
        <p className="mt-4 rounded-xl border border-stone-200 bg-white p-4 text-center text-sm text-stone-600">
          Jadwal bulan ini belum tersedia — tanyakan langsung via WhatsApp
          untuk info terbaru.
        </p>
      ) : (
        <div className="mt-4">
          <div
            className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-stone-500"
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
              const selected = selectedDate === date;
              const dayClass = `relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm font-medium ${cell}${past ? " opacity-60 saturate-50" : ""}${selected ? SELECTED_RING : ""}`;
              const dot = showDot ? (
                <span
                  aria-hidden="true"
                  className="absolute bottom-1 h-1 w-1 rounded-full bg-lime-700"
                />
              ) : null;
              // Past days stay inert so clients can't ask about the past.
              // No aria-label: a role-less div exposes no accessible name,
              // so labelling it would be silently ignored by AT.
              if (past) {
                return (
                  <div key={date} title={ariaLabel} className={dayClass}>
                    <span>{dayNum}</span>
                    {dot}
                  </div>
                );
              }
              return (
                <button
                  key={date}
                  type="button"
                  data-date={date}
                  title={ariaLabel}
                  aria-label={ariaLabel}
                  aria-pressed={selected}
                  onClick={() => handleDateTap(date)}
                  className={`${dayClass} transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1`}
                >
                  <span>{dayNum}</span>
                  {dot}
                </button>
              );
            })}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
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
                className="h-3 w-3 rounded bg-stone-200"
              />
              Tanggal lalu
            </li>
          </ul>
        </div>
      )}

      {popupOpen && selectedDate !== null ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            aria-hidden="true"
            onClick={closePopup}
            className="absolute inset-0 bg-stone-900/50"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Jadwal ${formatDayId(selectedDate)}`}
            aria-live="polite"
            className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-stone-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl sm:pb-4"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-bold">
                Jadwal {formatDayId(selectedDate)}
                {headerStatus ? ` · ${STATUS_META[headerStatus].label}` : ""}
              </p>
              <button
                // biome-ignore lint/a11y/noAutofocus: move focus into the
                // modal on open so keyboard and screen-reader users land
                // inside the popup; focus returns to the date on close.
                autoFocus
                type="button"
                onClick={closePopup}
                aria-label="Tutup"
                className="rounded-full border border-stone-300 px-3 py-1 text-sm font-semibold transition hover:bg-stone-100"
              >
                ✕
              </button>
            </div>
            {!detailLoaded && !detailError ? (
              <p className="mt-2 text-sm text-stone-600">Memuat detail…</p>
            ) : detailError || detail === null ? (
              <div className="mt-2 text-center">
                <p className="text-sm text-stone-600">
                  {detailError ?? "Gagal memuat detail jadwal. Coba lagi."}
                </p>
                <button
                  type="button"
                  onClick={() => setDetailAttempt((a) => a + 1)}
                  className="mt-3 rounded-full bg-stone-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-stone-700"
                >
                  Coba lagi
                </button>
              </div>
            ) : (
              <div>
                {isClosedDetail ? (
                  <p className="mt-2 rounded-lg bg-orange-100 px-3 py-2 text-sm font-medium text-red-900 ring-1 ring-inset ring-stone-900/5">
                    Sehari penuh — Tutup
                  </p>
                ) : mergedOccupied.length > 0 ? (
                  <div>
                    <ul className="mt-2 space-y-1.5">
                      {mergedOccupied.map((slot) => (
                        <li
                          key={`${slot.kind}-${slot.start}-${slot.end}`}
                          className={`rounded-lg px-3 py-2 text-sm font-medium ${OCCUPIED_META[slot.kind].row}`}
                        >
                          {OCCUPIED_META[slot.kind].label} {slot.start}–
                          {slot.end}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-stone-600">
                      Di luar jam di atas masih bisa ditanyakan — pilih jam
                      yang kamu mau di bawah, lalu tanyakan via WhatsApp.
                    </p>
                  </div>
                ) : detail.status === "fully_booked" ? (
                  <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900 ring-1 ring-inset ring-stone-900/5">
                    Jadwal terisi penuh.
                  </p>
                ) : (
                  <p className="mt-2 rounded-lg bg-lime-100 px-3 py-2 text-sm font-medium text-green-900 ring-1 ring-inset ring-stone-900/5">
                    Seharian tersedia
                  </p>
                )}
                {isBookableDetail ? (
                  <div className="mt-3 border-t border-stone-200 pt-3">
                    <p className="text-sm font-semibold">Mau jam berapa?</p>
                    <div className="mt-2 flex gap-2">
                      <label className="flex-1 text-xs font-medium text-stone-600">
                        Jam mulai
                        <input
                          type="time"
                          value={startTime}
                          onChange={(event) =>
                            setStartTime(event.target.value)
                          }
                          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
                        />
                      </label>
                      <label className="flex-1 text-xs font-medium text-stone-600">
                        Jam selesai
                        <input
                          type="time"
                          value={endTime}
                          onChange={(event) => setEndTime(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
                        />
                      </label>
                    </div>
                    {pickerVerdict === "hint" ? (
                      <p className="mt-2 text-xs text-stone-600">
                        Pilih jam mulai dan jam selesai dulu.
                      </p>
                    ) : pickerVerdict === "order" ? (
                      <p role="alert" className="mt-2 text-xs font-medium text-red-700">
                        Jam selesai harus setelah jam mulai.
                      </p>
                    ) : pickerVerdict === "overlap" ? (
                      <p role="alert" className="mt-2 text-xs font-medium text-red-700">
                        Jam yang dipilih bentrok dengan jadwal yang sudah
                        terisi — pilih jam lain.
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {pickerVerdict === "valid" ? (
                        <a
                          href={buildDateTimeWaLink(
                            waNumber,
                            detail.date,
                            startTime,
                            endTime,
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block rounded-full bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700"
                        >
                          Tanya jam ini via WhatsApp
                        </a>
                      ) : (
                        <span
                          aria-disabled="true"
                          className="inline-block cursor-not-allowed rounded-full bg-stone-200 px-6 py-2.5 text-sm font-semibold text-stone-600"
                        >
                          Tanya jam ini via WhatsApp
                        </span>
                      )}
                      <a
                        href={buildDateWaLink(waNumber, detail.date)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block rounded-full border border-stone-300 px-6 py-2.5 text-sm font-semibold transition hover:bg-stone-100"
                      >
                        Tanya tanggal ini via WhatsApp
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Single-action rule: the popup's date chat action carries the
          inquiry while open; the general starter shows only when no
          popup is open. While the popup loads or errors there is no
          CTA until the date action is ready. */}
      {!popupOpen ? (
        <a
          href={buildGeneralWaLink(waNumber)}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block rounded-full border border-stone-300 px-6 py-2.5 text-sm font-semibold transition hover:bg-stone-100"
        >
          Tanya Jadwal via WhatsApp
        </a>
      ) : null}
    </div>
  );
}
