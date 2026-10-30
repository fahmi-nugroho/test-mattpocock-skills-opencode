"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [rowError, setRowError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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

  async function onToggleFull(e: React.FormEvent) {
    e.preventDefault();
    if (toggling || !fullDateInput) return;
    setToggleError(null);
    setToggling(true);
    try {
      const next = await toggleFullDate(supabaseBrowser(), fullDateInput);
      setFullDates(next);
      notifyScheduleChanged();
    } catch (err) {
      setToggleError(
        err instanceof Error ? err.message : "Gagal mengubah tanda penuh. Coba lagi.",
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
      setRowError("Tanggal blokir harus format YYYY-MM-DD");
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
      setRowError(
        err instanceof Error ? err.message : "Gagal menyimpan perubahan. Coba lagi.",
      );
    } finally {
      setRowBusy(null);
    }
  }

  async function onDelete(item: Block) {
    if (confirmDeleteId !== item.id) {
      setConfirmDeleteId(item.id);
      return;
    }
    if (rowBusy) return;
    setRowError(null);
    setRowBusy(item.id);
    try {
      await deleteBlock(supabaseBrowser(), item.id);
      setItems((prev) => prev.filter((p) => p.id !== item.id));
      notifyScheduleChanged();
      setConfirmDeleteId(null);
      if (editingId === item.id) setEditingId(null);
    } catch {
      setRowError("Gagal menghapus blokir. Coba lagi.");
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
      {rowError ? (
        <p role="alert" className="text-sm text-red-600">
          {rowError}
        </p>
      ) : null}

      <form
        onSubmit={onCreate}
        className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <h3 className="text-sm font-bold">Tambah blokir</h3>
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
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="h-4 w-4 accent-espresso"
          />
          <span className="text-sm font-medium">Sehari penuh</span>
        </label>
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

      <form
        onSubmit={onToggleFull}
        className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <h3 className="text-sm font-bold">Tandai tanggal penuh (manual)</h3>
        <p className="text-xs text-neutral-600">
          Tanggal penuh tampil Tutup di kalender publik — sama seperti blokir
          sehari penuh.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-sm font-medium">Tanggal</span>
            <input
              type="date"
              required
              value={fullDateInput}
              onChange={(e) => setFullDateInput(e.target.value)}
              className="mt-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={toggling}
            className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold transition hover:bg-neutral-100 disabled:opacity-60"
          >
            {toggling
              ? "Menyimpan…"
              : fullDates.includes(fullDateInput)
                ? "Hapus tanda penuh"
                : "Tandai penuh"}
          </button>
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
                {d}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-neutral-600">
            Belum ada tanggal yang ditandai penuh.
          </p>
        )}
      </form>

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
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="date"
                  aria-label="Tanggal"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm sm:col-span-2"
                />
                <label className="flex items-center gap-2 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={editAllDay}
                    onChange={(e) => setEditAllDay(e.target.checked)}
                    className="h-4 w-4 accent-espresso"
                  />
                  <span className="text-sm">Sehari penuh</span>
                </label>
                {!editAllDay ? (
                  <>
                    <input
                      type="time"
                      aria-label="Jam mulai"
                      value={editStart}
                      onChange={(e) => setEditStart(e.target.value)}
                      className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      type="time"
                      aria-label="Jam selesai"
                      value={editEnd}
                      onChange={(e) => setEditEnd(e.target.value)}
                      className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                    />
                  </>
                ) : null}
                <input
                  type="text"
                  aria-label="Alasan"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm sm:col-span-2"
                />
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold">
                  {item.date} ·{" "}
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
            <div className="mt-3 flex flex-wrap gap-2">
              {editingId === item.id ? (
                <>
                  <button
                    type="button"
                    disabled={rowBusy === item.id}
                    onClick={() => onSaveEdit(item)}
                    className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {rowBusy === item.id ? "Menyimpan…" : "Simpan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold"
                  >
                    Batal
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold"
                >
                  Ubah
                </button>
              )}
              <button
                type="button"
                disabled={rowBusy === item.id}
                onClick={() => onDelete(item)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-60 ${
                  confirmDeleteId === item.id
                    ? "bg-red-600 text-white"
                    : "border border-red-300 text-red-700"
                }`}
              >
                {rowBusy === item.id
                  ? "Menghapus…"
                  : confirmDeleteId === item.id
                    ? "Klik lagi untuk hapus"
                    : "Hapus"}
              </button>
            </div>
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
