"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { filterByQuery } from "@/lib/admin/filter-items";
import { validateBlockInput } from "@/lib/admin/validate-block";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  createBlock,
  deleteBlock,
  listBlocksAdmin,
  updateBlock,
} from "@/lib/supabase/admin-blocks";
import { getFullDates, toggleFullDate } from "@/lib/supabase/admin-full-dates";
import type { Block } from "@/lib/supabase/database";
import { formatDateId } from "@/lib/format";
import { getTodayKey } from "@/lib/calendar";
import { notifyScheduleChanged, SCHEDULE_CHANGED_EVENT } from "@/lib/admin/schedule-events";

/**
 * Block + manual full-toggle manager for the admin dashboard
 * (ticket 07). Blocks are all-day OR a time-range with reason; saving
 * runs the confirmed-booking guard so a block can never silently cover
 * a confirmed booking. full_dates is the manual "tandai penuh" toggle
 * per date — same "blocked" signal as an all-day block in the public
 * month RPC.
 */
export function BlocksManager() {
  const [items, setItems] = useState<Block[]>([]);
  const [fullDates, setFullDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(() => getTodayKey());
  const [allDay, setAllDay] = useState(true);
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("14:00");
  const [reason, setReason] = useState("");
  const [fullDateInput, setFullDateInput] = useState(() => getTodayKey());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editAllDay, setEditAllDay] = useState(true);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editReason, setEditReason] = useState("");
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [query, setQuery] = useState("");

  // Client-side search over visible text fields only; CRUD/data flow
  // below is unchanged.
  const visibleItems = useMemo(
    () => filterByQuery(items, query, (item) => [item.date, item.reason]),
    [items, query],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = supabaseBrowser();
        const [blocks, dates] = await Promise.all([
          listBlocksAdmin(supabase),
          getFullDates(supabase),
        ]);
        if (!cancelled) {
          setItems(blocks);
          setFullDates(dates);
        }
      } catch {
        if (!cancelled) setError("Gagal memuat blokir. Coba lagi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    // Another panel mutated the schedule (e.g. calendar full-toggle):
    // refetch so the block + full-date lists stay in sync.
    const onChange = () => {
      if (!cancelled) load();
    };
    window.addEventListener(SCHEDULE_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(SCHEDULE_CHANGED_EVENT, onChange);
    };
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
    let validated;
    try {
      validated = validateBlockInput({
        date,
        all_day: allDay,
        start_time: allDay ? null : start,
        end_time: allDay ? null : end,
        reason,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Input tidak valid");
      return;
    }
    setSaving(true);
    try {
      const row = await createBlock(supabaseBrowser(), validated);
      setItems((prev) =>
        [...prev, row].sort((a, b) =>
          a.date === b.date
            ? (a.start_time ?? "").localeCompare(b.start_time ?? "")
            : a.date.localeCompare(b.date),
        ),
      );
      setReason("");
      notifyScheduleChanged();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Gagal menyimpan blokir. Coba lagi.",
      );
    } finally {
      setSaving(false);
    }
  }

  const markedFull = fullDates.includes(fullDateInput);
  const validFullDate = /^\d{4}-\d{2}-\d{2}$/.test(fullDateInput);

  async function onToggleFull() {
    if (toggling || !validFullDate) return;
    setToggleError(null);
    setToggling(true);
    try {
      const next = await toggleFullDate(supabaseBrowser(), fullDateInput, !markedFull);
      setFullDates(next);
      notifyScheduleChanged();
    } catch (err) {
      setToggleError(
        err instanceof Error ? err.message : "Gagal mengubah penutupan manual. Coba lagi.",
      );
    } finally {
      setToggling(false);
    }
  }

  function startEdit(item: Block) {
    setEditingId(item.id);
    setRowError(null);
    setEditDate(item.date);
    setEditAllDay(item.all_day);
    setEditStart(item.start_time ?? "");
    setEditEnd(item.end_time ?? "");
    setEditReason(item.reason);
  }

  async function onSaveEdit(item: Block) {
    if (rowBusy) return;
    setRowError(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editDate)) {
      setRowError({ id: item.id, message: "Tanggal blokir harus format YYYY-MM-DD" });
      return;
    }
    setRowBusy(item.id);
    try {
      const row = await updateBlock(supabaseBrowser(), item.id, {
        date: editDate,
        all_day: editAllDay,
        start_time: editAllDay ? null : editStart || null,
        end_time: editAllDay ? null : editEnd || null,
        reason: editReason,
      });
      setItems((prev) => prev.map((p) => (p.id === item.id ? row : p)));
      setEditingId(null);
      notifyScheduleChanged();
    } catch (err) {
      setRowError({ id: item.id, message: err instanceof Error ? err.message : "Gagal menyimpan perubahan. Coba lagi." });
    } finally {
      setRowBusy(null);
    }
  }

  async function onDelete(item: Block) {
    if (rowBusy) return;
    setRowError(null);
    setRowBusy(item.id);
    try {
      await deleteBlock(supabaseBrowser(), item.id);
      setItems((prev) => prev.filter((p) => p.id !== item.id));
      notifyScheduleChanged();
      if (editingId === item.id) setEditingId(null);
    } catch {
      setRowError({ id: item.id, message: "Gagal menghapus blokir. Coba lagi." });
    } finally {
      setRowBusy(null);
    }
  }

  if (loading) {
    return <p className="mt-3 text-sm text-neutral-600">Memuat blokir…</p>;
  }

  return (
    <div className="mt-4 space-y-4">
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={onCreate}
        className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <h3 className="text-sm font-bold">Tambah blokir</h3>
        <p className="text-sm text-neutral-600">
          Blokir jam tertentu atau satu hari penuh. Untuk melepas blokir, hapus dari daftar blokir.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Tanggal</span>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Alasan</span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="mis. Libur / acara keluarga"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex min-h-10 items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="h-4 w-4 accent-espresso"
            />
            <span className="text-sm font-medium">Blokir sepanjang hari</span>
          </label>
          {!allDay ? (
            <>
              <label className="block">
                <span className="text-sm font-medium">Jam mulai</span>
                <input
                  type="time"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Jam selesai</span>
                <input
                  type="time"
                  required
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>
            </>
          ) : null}
        </div>
        {formError ? (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-neutral-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
        >
          {saving ? "Menyimpan…" : "Tambah blokir"}
        </button>
      </form>

      <section aria-labelledby="full-date-title" className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
        <h3 id="full-date-title" className="text-sm font-bold">Penutupan manual kalender publik</h3>
        <p className="text-sm text-neutral-600">
          Tutup satu tanggal untuk pertanyaan baru dari klien. Saat penutupan manual dihapus, booking dan blokir yang tercatat tetap berlaku.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-sm font-medium">Tanggal</span>
            <input
              type="date"
              required
              value={fullDateInput}
              onChange={(e) => {
                setFullDateInput(e.target.value);
                setToggleError(null);
              }}
              className="mt-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <ConfirmAction
            label={markedFull ? "Hapus penutupan manual" : "Tutup tanggal secara manual"}
            title={`${markedFull ? "Hapus penutupan manual untuk" : "Tutup kalender publik untuk"} ${validFullDate ? formatDateId(fullDateInput) : "tanggal ini"}?`}
            description={markedFull
              ? "Kalender publik akan kembali mengikuti booking dan blokir yang masih tercatat."
              : "Tanggal ini akan tampil tutup di kalender publik. Booking dan blokir yang sudah tercatat tetap berlaku."}
            onConfirm={onToggleFull}
            disabled={toggling || !validFullDate}
          />
        </div>
        {toggleError ? (
          <p role="alert" className="text-sm text-red-600">
            {toggleError}
          </p>
        ) : null}
        {fullDates.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {fullDates.map((d) => (
              <li
                key={d}
                className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-900"
              >
                {formatDateId(d)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-neutral-600">
            Belum ada tanggal yang ditutup secara manual.
          </p>
        )}
      </section>

      <h3 className="pt-2 text-base font-bold">Daftar blokir</h3>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari blokir…"
        aria-label="Cari blokir"
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
      />
      <ul className="space-y-2">
        {visibleItems.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-neutral-200 bg-white p-3"
          >
            {editingId === item.id ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block min-w-0 sm:col-span-2">
                  <span className="text-sm font-medium">Tanggal</span>
                  <input
                    type="date"
                    autoFocus
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex items-center gap-2 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={editAllDay}
                    onChange={(e) => setEditAllDay(e.target.checked)}
                    className="h-4 w-4 accent-espresso"
                  />
                  <span className="text-sm">Blokir sepanjang hari</span>
                </label>
                {!editAllDay ? (
                  <>
                    <label className="block min-w-0">
                      <span className="text-sm font-medium">Jam mulai</span>
                      <input
                        type="time"
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                        className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="text-sm font-medium">Jam selesai</span>
                      <input
                        type="time"
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                        className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      />
                    </label>
                  </>
                ) : null}
                <label className="block min-w-0 sm:col-span-2">
                  <span className="text-sm font-medium">Alasan</span>
                  <input
                    type="text"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold">
                  {formatDateId(item.date)} ·{" "}
                  {item.all_day
                    ? "Sehari penuh"
                    : `${item.start_time}–${item.end_time}`}
                </p>
                {item.reason ? (
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {item.reason}
                  </p>
                ) : null}
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {editingId === item.id ? (
                <>
                  <button
                    type="button"
                    disabled={rowBusy === item.id}
                    onClick={() => onSaveEdit(item)}
                    className="min-h-10 rounded-full bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-60"
                  >
                    {rowBusy === item.id ? "Menyimpan…" : "Simpan"}
                  </button>
                  <button
                    type="button"
                    disabled={rowBusy === item.id}
                    onClick={() => {
                      setEditingId(null);
                      setRowError(null);
                    }}
                    className="min-h-10 rounded-full border border-neutral-300 px-3 text-sm font-semibold hover:bg-neutral-100 disabled:opacity-60"
                  >
                    Batal
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={rowBusy !== null}
                  onClick={() => startEdit(item)}
                  className="min-h-10 rounded-full border border-neutral-300 px-3 text-sm font-semibold hover:bg-neutral-100 disabled:opacity-60"
                >
                  Ubah
                </button>
              )}
              {editingId !== item.id ? (
                <ConfirmAction
                  label="Hapus blokir"
                  title={`Hapus blokir ${formatDateId(item.date)}?`}
                  description="Jam yang diblokir dapat tersedia kembali di kalender publik."
                  onConfirm={() => onDelete(item)}
                  disabled={rowBusy !== null}
                  destructive
                />
              ) : null}
            </div>
            {rowError?.id === item.id ? (
              <p role="alert" className="mt-2 text-sm text-red-700">{rowError.message}</p>
            ) : null}
          </li>
        ))}
      </ul>
      {items.length === 0 && !error ? (
        <p className="text-sm text-neutral-600">
          Belum ada blokir — tambah libur atau jam tutup di atas.
        </p>
      ) : null}
      {items.length > 0 && visibleItems.length === 0 ? (
        <p className="text-sm text-neutral-600">
          {`Tidak ada hasil untuk "${query.trim()}".`}
        </p>
      ) : null}
    </div>
  );
}
