"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { computeDayStatus, type DayStatus } from "@/lib/availability";
import {
  WEEKDAY_HEADERS_ID,
  formatMonthId,
  getMonthCells,
  getTodayKey,
  isPastDate,
  parseMonthKey,
  shiftMonth,
} from "@/lib/calendar";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BOOKING_STATUS_LABEL } from "@/lib/admin/booking-filter";
import { formatDateId } from "@/lib/format";
import {
  SCHEDULE_CHANGED_EVENT,
  notifyScheduleChanged,
} from "@/lib/admin/schedule-events";
import { listBookingsAdmin } from "@/lib/supabase/admin-bookings";
import { listBlocksAdmin } from "@/lib/supabase/admin-blocks";
import { getFullDates, toggleFullDate } from "@/lib/supabase/admin-full-dates";
import type { Block, Booking } from "@/lib/supabase/database";

const STATUS_META: Record<DayStatus, { label: string; cell: string }> = {
  available: { label: "Bisa ditanyakan", cell: "bg-neutral-50 text-espresso" },
  // DEAD CODE (hours-removal contract): fully_booked is unreachable —
  // with no operating window, coverage derivation was removed and nothing
  // resolves to this status. Kept so the legend/metadata can be revived
  // with the status itself (see docs/adr/0001-hours-removal.md).
  fully_booked: { label: "Penuh", cell: "bg-amber-200 text-amber-900" },
  blocked: { label: "Tutup", cell: "bg-red-100 text-red-900" },
};

const WORKLOAD = [
  { key: "confirmed", short: "T", label: "Terkonfirmasi", color: "text-emerald-800" },
  { key: "pending", short: "M", label: "Menunggu", color: "text-amber-800" },
  { key: "timedBlocks", short: "B", label: "Blokir jam", color: "text-violet-800" },
] as const;

/**
 * Admin month calendar + day list (ticket 07). Day colours derive
 * client-side via computeDayStatus from the admin-loaded confirmed
 * bookings + blocks + manual full_dates — the same rule the public
 * month RPC mirrors in SQL — so confirming/cancelling a booking or
 * toggling a date visibly moves the public day-status (04) on next
 * public load. Client-side derivation (not the RPC) is deliberate: the
 * admin already sees raw rows, and the shared computeDayStatus seam
 * keeps both implementations on one rule. Selecting a day lists its bookings/blocks (list view)
 * with a per-date full-toggle button.
 */
export function AdminCalendar({ onOpenBookings }: { onOpenBookings: (date: string) => void }) {
  const [monthKey, setMonthKey] = useState(() => getTodayKey().slice(0, 7));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [fullDates, setFullDates] = useState<string[]>([]);
  const [selected, setSelected] = useState(() => getTodayKey());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  useEffect(() => {
    let latestLoad = 0;
    async function load() {
      const currentLoad = ++latestLoad;
      try {
        const supabase = supabaseBrowser();
        const [bookingRows, blockRows, dates] = await Promise.all([
          listBookingsAdmin(supabase),
          listBlocksAdmin(supabase),
          getFullDates(supabase),
        ]);
        if (currentLoad === latestLoad) {
          setBookings(bookingRows);
          setBlocks(blockRows);
          setFullDates(dates);
          setError(null);
        }
      } catch {
        if (currentLoad === latestLoad) setError("Gagal memuat kalender admin. Coba lagi.");
      } finally {
        if (currentLoad === latestLoad) setLoading(false);
      }
    }
    void load();
    window.addEventListener(SCHEDULE_CHANGED_EVENT, load);
    return () => {
      latestLoad++;
      window.removeEventListener(SCHEDULE_CHANGED_EVENT, load);
    };
  }, [loadAttempt]);

  const { year, month } = parseMonthKey(monthKey);
  const cells = useMemo(() => getMonthCells(year, month), [year, month]);
  const todayKey = useMemo(() => getTodayKey(), []);
  const monthLabel = formatMonthId(monthKey);

  const days = useMemo(() => Object.fromEntries(cells.flatMap((date) => {
    if (date === null) return [];
    const dayBookings = bookings.filter((booking) => booking.date === date);
    const dayBlocks = blocks.filter((block) => block.date === date);
    const confirmed = dayBookings.filter((booking) => booking.status === "confirmed");
    const status = computeDayStatus(date, confirmed, dayBlocks.map((block) => ({
      all_day: block.all_day,
      start_time: block.start_time ?? undefined,
      end_time: block.end_time ?? undefined,
    })), fullDates);
    return [[date, {
      status,
      bookings: dayBookings,
      blocks: dayBlocks,
      counts: {
        confirmed: confirmed.length,
        pending: dayBookings.filter((booking) => booking.status === "pending").length,
        timedBlocks: dayBlocks.filter((block) => !block.all_day).length,
      },
    }] as const];
  })), [bookings, blocks, fullDates, cells]);

  const selectedDay = days[selected];
  const selectedBookings = selectedDay?.bookings ?? [];
  const selectedBlocks = selectedDay?.blocks ?? [];
  const selectedStatus = STATUS_META[selectedDay?.status ?? "available"].label;
  const selectedWorkload = WORKLOAD.filter(({ key }) => selectedDay?.counts[key] > 0);
  const selectedIsFull = fullDates.includes(selected);

  function selectDate(date: string) {
    setSelected(date);
    setToggleError(null);
  }

  function showMonth(next: string) {
    setMonthKey(next);
    selectDate(next === todayKey.slice(0, 7) ? todayKey : `${next}-01`);
  }

  async function onToggleSelected() {
    if (toggling) return;
    setToggleError(null);
    setToggling(true);
    try {
      const next = await toggleFullDate(supabaseBrowser(), selected, !selectedIsFull);
      setFullDates(next);
      notifyScheduleChanged();
    } catch {
      setToggleError("Gagal mengubah tanda penuh. Coba lagi.");
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return <p role="status" className="mt-3 text-sm text-neutral-600">Memuat kalender…</p>;
  }
  if (error) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p role="alert" className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setLoading(true);
            setLoadAttempt((attempt) => attempt + 1);
          }}
          className="min-h-10 rounded-full border border-neutral-300 bg-white px-4 text-sm font-semibold hover:bg-neutral-100"
        >
          Muat ulang
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-6">
      <div className="max-w-xl rounded-xl border border-neutral-200 bg-white p-3 sm:p-4 xl:max-w-none">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => showMonth(shiftMonth(monthKey, -1))}
            aria-label="Bulan sebelumnya"
            className="size-11 shrink-0 rounded-full border border-neutral-300 text-lg font-semibold transition hover:bg-neutral-100"
          >
            ‹
          </button>
          <p aria-live="polite" className="text-base font-bold">
            {monthLabel}
          </p>
          <button
            type="button"
            onClick={() => showMonth(shiftMonth(monthKey, 1))}
            aria-label="Bulan berikutnya"
            className="size-11 shrink-0 rounded-full border border-neutral-300 text-lg font-semibold transition hover:bg-neutral-100"
          >
            ›
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-y border-neutral-200 py-2 xl:hidden">
          <div aria-live="polite" className="min-w-0 text-sm">
            <p className="font-semibold">{formatDateId(selected)}</p>
            <p className="mt-0.5 text-neutral-600">
              {selectedWorkload.length ? selectedWorkload.map(({ key, label }) => `${selectedDay.counts[key]} ${label.toLowerCase()}`).join(" · ") : "Tidak ada booking aktif atau blokir jam"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => document.getElementById("admin-day-title")?.focus()}
            className="min-h-11 shrink-0 rounded-full border border-neutral-300 px-3 text-sm font-semibold hover:bg-neutral-100"
          >
            Rincian
          </button>
        </div>

        <ul aria-label="Kode kegiatan" className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-700">
          {WORKLOAD.map(({ key, short, label, color }) => (
            <li key={key}><span className={`mr-1 font-bold ${color}`}>{short}</span>{label}</li>
          ))}
        </ul>

        <div
          className="mt-2 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-neutral-600"
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
            const { status, counts } = days[date];
            const markers = WORKLOAD.filter(({ key }) => counts[key] > 0);
            const past = isPastDate(date, todayKey);
            const dayNum = Number(date.slice(8, 10));
            const active = date === selected;
            return (
              <button
                key={date}
                type="button"
                data-date={date}
                onClick={() => selectDate(date)}
                aria-label={[
                  `${dayNum} ${monthLabel}, kalender publik ${STATUS_META[status].label.toLowerCase()}`,
                  ...markers.map(({ key, label }) => `${counts[key]} ${label.toLowerCase()}`),
                ].join(", ")}
                aria-pressed={active}
                aria-current={date === todayKey ? "date" : undefined}
                className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg text-sm font-medium hover:brightness-95 sm:aspect-square ${STATUS_META[status].cell}${past ? " saturate-50" : ""}${active ? " ring-2 ring-inset ring-neutral-900" : ""}`}
              >
                <span className={date === todayKey ? "font-bold underline underline-offset-2" : undefined}>{dayNum}</span>
                <span aria-hidden="true" className="flex min-h-3 gap-0.5 text-xs font-bold leading-none">
                  {markers.map(({ key, short, color }) => <span key={key} className={color}>{short}</span>)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-neutral-700">Kalender publik</span>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-espresso">Bisa ditanyakan</span>
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-900">Tutup</span>
          <button
            type="button"
            onClick={() => showMonth(todayKey.slice(0, 7))}
            className="ml-auto min-h-11 rounded-full border border-neutral-300 px-3 text-sm font-semibold hover:bg-neutral-100"
          >
            Hari ini
          </button>
        </div>
      </div>

      <div className="mt-4 max-w-xl rounded-xl border border-neutral-200 bg-white p-4 xl:mt-0">
        <div>
          <h3 id="admin-day-title" tabIndex={-1} className="scroll-mt-24 text-base font-bold">{formatDateId(selected)}</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Kalender publik · {selectedStatus}
          </p>
        </div>
        {toggleError ? (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {toggleError}
          </p>
        ) : null}
        {selectedBookings.length === 0 && selectedBlocks.length === 0 ? (
          <p className="mt-3 border-t border-neutral-200 pt-3 text-xs text-neutral-600">
            Belum ada booking/blokir pada tanggal ini.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 border-t border-neutral-200 pt-3">
            {selectedBookings.map((b) => (
              <li key={b.id} className="[overflow-wrap:anywhere] text-sm text-neutral-700">
                <span className="font-medium tabular-nums">
                  {b.start_time}–{b.end_time}
                </span>{" "}
                · {b.client_name} · {BOOKING_STATUS_LABEL[b.status]}
              </li>
            ))}
            {selectedBlocks.map((b) => (
              <li key={b.id} className="[overflow-wrap:anywhere] text-sm text-neutral-700">
                Blokir{" "}
                {b.all_day ? "sehari penuh" : `${b.start_time}–${b.end_time}`}
                {b.reason ? ` · ${b.reason}` : ""}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-200 pt-3">
          {selectedBookings.length ? (
            <button
              type="button"
              onClick={() => onOpenBookings(selected)}
              className="min-h-11 rounded-full bg-espresso px-4 text-sm font-semibold text-white hover:bg-stone-700"
            >
              Lihat booking tanggal ini
            </button>
          ) : null}
          <ConfirmAction
            label={selectedIsFull ? "Hapus tanda penuh" : "Tandai penuh"}
            title={`${selectedIsFull ? "Hapus tanda penuh untuk" : "Tandai penuh"} ${formatDateId(selected)}?`}
            description={selectedIsFull
              ? "Kalender publik akan kembali mengikuti blokir pada tanggal ini."
              : "Tanggal ini akan tampil tutup di kalender publik."}
            onConfirm={onToggleSelected}
            disabled={toggling}
          />
        </div>
      </div>
    </div>
  );
}
