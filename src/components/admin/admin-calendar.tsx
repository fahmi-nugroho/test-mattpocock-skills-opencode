"use client";

import { useEffect, useMemo, useState } from "react";
import { computeDayStatus, type DayStatus } from "@/lib/availability";
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
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  SCHEDULE_CHANGED_EVENT,
  notifyScheduleChanged,
} from "@/lib/admin/schedule-events";
import { listBookingsAdmin } from "@/lib/supabase/admin-bookings";
import { listBlocksAdmin } from "@/lib/supabase/admin-blocks";
import { getFullDates, toggleFullDate } from "@/lib/supabase/admin-full-dates";
import type { Block, Booking } from "@/lib/supabase/database";

const STATUS_META: Record<DayStatus, { label: string; cell: string }> = {
  available: { label: "Tersedia", cell: "bg-green-100 text-green-900" },
  // DEAD CODE (hours-removal contract): fully_booked is unreachable —
  // with no operating window, coverage derivation was removed and nothing
  // resolves to this status. Kept so the legend/metadata can be revived
  // with the status itself (see docs/adr/0001-hours-removal.md).
  fully_booked: { label: "Penuh", cell: "bg-amber-200 text-amber-900" },
  blocked: { label: "Tutup", cell: "bg-red-100 text-red-900" },
};

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
export function AdminCalendar() {
  const [monthKey, setMonthKey] = useState(() => {
    const now = new Date();
    return toMonthKey(now.getFullYear(), now.getMonth() + 1);
  });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [fullDates, setFullDates] = useState<string[]>([]);
  const [selected, setSelected] = useState(() => getTodayKey());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = supabaseBrowser();
        const [bookingRows, blockRows, dates] = await Promise.all([
          listBookingsAdmin(supabase),
          listBlocksAdmin(supabase),
          getFullDates(supabase),
        ]);
        if (!cancelled) {
          setBookings(bookingRows);
          setBlocks(blockRows);
          setFullDates(dates);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Gagal memuat kalender admin. Coba lagi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const onChange = () => {
      if (!cancelled) load();
    };
    window.addEventListener(SCHEDULE_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(SCHEDULE_CHANGED_EVENT, onChange);
    };
  }, []);

  const { year, month } = parseMonthKey(monthKey);
  const cells = useMemo(() => getMonthCells(year, month), [year, month]);
  const todayKey = useMemo(() => getTodayKey(), []);
  const monthLabel = formatMonthId(monthKey);

  const statusByDate = useMemo(() => {
    const map: Record<string, DayStatus> = {};
    for (const date of cells) {
      if (date === null) continue;
      const dayBookings = bookings
        .filter((b) => b.date === date && b.status === "confirmed")
        .map((b) => ({ start_time: b.start_time, end_time: b.end_time }));
      const dayBlocks = blocks
        .filter((b) => b.date === date)
        .map((b) => ({
          all_day: b.all_day,
          start_time: b.start_time ?? undefined,
          end_time: b.end_time ?? undefined,
        }));
      map[date] = computeDayStatus(date, dayBookings, dayBlocks, fullDates);
    }
    return map;
  }, [bookings, blocks, fullDates, cells]);

  const selectedBookings = bookings.filter((b) => b.date === selected);
  const selectedBlocks = blocks.filter((b) => b.date === selected);
  const selectedIsFull = fullDates.includes(selected);

  async function onToggleSelected() {
    if (toggling) return;
    setToggleError(null);
    setToggling(true);
    try {
      const next = await toggleFullDate(supabaseBrowser(), selected);
      setFullDates(next);
      notifyScheduleChanged();
    } catch {
      setToggleError("Gagal mengubah tanda penuh. Coba lagi.");
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return <p className="mt-3 text-sm text-neutral-600">Memuat kalender…</p>;
  }
  if (error) {
    return (
      <p role="alert" className="mt-3 text-sm text-red-600">
        {error}
      </p>
    );
  }

  return (
    <div className="mt-4">
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

      <div
        className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-neutral-500"
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
          const active = date === selected;
          return (
            <button
              key={date}
              type="button"
              onClick={() => setSelected(date)}
              aria-label={`${dayNum} ${monthLabel}: ${STATUS_META[status].label}`}
              aria-pressed={active}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg text-sm font-medium ${STATUS_META[status].cell}${past ? " opacity-60 saturate-50" : ""}${active ? " ring-2 ring-neutral-900" : ""}`}
            >
              <span>{dayNum}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold">
            {selected} · {STATUS_META[statusByDate[selected] ?? "available"].label}
          </p>
          <button
            type="button"
            onClick={onToggleSelected}
            disabled={toggling}
            className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold disabled:opacity-60"
          >
            {toggling
              ? "Menyimpan…"
              : selectedIsFull
                ? "Hapus tanda penuh"
                : "Tandai penuh"}
          </button>
        </div>
        {toggleError ? (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {toggleError}
          </p>
        ) : null}
        {selectedBookings.length === 0 && selectedBlocks.length === 0 ? (
          <p className="mt-2 text-xs text-neutral-600">
            Belum ada booking/blokir pada tanggal ini.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {selectedBookings.map((b) => (
              <li key={b.id} className="text-xs text-neutral-700">
                Booking {b.start_time}–{b.end_time} · {b.client_name} ·{" "}
                {b.status}
              </li>
            ))}
            {selectedBlocks.map((b) => (
              <li key={b.id} className="text-xs text-neutral-700">
                Blokir{" "}
                {b.all_day ? "sehari penuh" : `${b.start_time}–${b.end_time}`}
                {b.reason ? ` · ${b.reason}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
