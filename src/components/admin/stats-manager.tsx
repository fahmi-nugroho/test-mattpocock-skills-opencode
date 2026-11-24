"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { filterByQuery } from "@/lib/admin/filter-items";
import { validateStatInput } from "@/lib/admin/validate-stat";
import { parseRequiredNumber } from "@/lib/admin/form-number";
import { resolveDisplayedStats } from "@/lib/hero-proof";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  createProfileStat,
  deleteProfileStat,
  listProfileStatsAdmin,
  updateProfileStat,
} from "@/lib/supabase/admin-profile-stats";
import type { ProfileStatRow } from "@/lib/supabase/database";

/**
 * Stat CRUD manager for the admin dashboard (ticket 03). Text-only rows
 * (value + label, mis. "10+ Tahun / Pengalaman"): no image upload or
 * storage cleanup, unlike portfolio/services. Creates/edits sort +
 * visible, toggles visibility, deletes with confirm. Reads the same
 * `profile_stats` table the public landing reads (max 4 visible on
 * landing), so saved changes appear on the landing on next load.
 */
export function StatsManager() {
  const [items, setItems] = useState<ProfileStatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [sort, setSort] = useState("0");
  const [visible, setVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editSort, setEditSort] = useState("0");
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [query, setQuery] = useState("");

  // Client-side search over visible text fields only; CRUD/data flow
  // below mirrors TestimonialsManager.
  const filteredItems = useMemo(
    () => filterByQuery(items, query, (item) => [item.value, item.label]),
    [items, query],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listProfileStatsAdmin(supabaseBrowser());
        if (!cancelled) setItems(rows);
      } catch {
        if (!cancelled) setError("Gagal memuat stat. Coba lagi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
    setCreated(false);
    let validated;
    try {
      validated = validateStatInput({
        value,
        label,
        sort: parseRequiredNumber(sort, "Urutan"),
        visible,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Input tidak valid");
      return;
    }
    setSaving(true);
    try {
      const row = await createProfileStat(supabaseBrowser(), validated);
      setItems((prev) => [...prev, row].sort((a, b) => a.sort - b.sort));
      setQuery("");
      setCreated(true);
      setValue("");
      setLabel("");
      setSort("0");
      setVisible(true);
    } catch {
      setFormError("Gagal menyimpan stat. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  async function onToggleVisible(item: ProfileStatRow) {
    if (rowBusy) return;
    setRowError(null);
    setRowBusy(item.id);
    try {
      const row = await updateProfileStat(supabaseBrowser(), item.id, {
        visible: !item.visible,
      });
      setItems((prev) => prev.map((p) => (p.id === item.id ? row : p)));
    } catch {
      setRowError({ id: item.id, message: "Gagal mengubah visibilitas. Coba lagi." });
    } finally {
      setRowBusy(null);
    }
  }

  function startEdit(item: ProfileStatRow) {
    setEditingId(item.id);
    setEditValue(item.value);
    setEditLabel(item.label);
    setEditSort(String(item.sort));
    setRowError(null);
  }

  async function onSaveEdit(item: ProfileStatRow) {
    if (rowBusy) return;
    setRowError(null);
    let validated;
    try {
      validated = validateStatInput({
        value: editValue,
        label: editLabel,
        sort: parseRequiredNumber(editSort, "Urutan"),
        visible: item.visible,
      });
    } catch (err) {
      setRowError({ id: item.id, message: err instanceof Error ? err.message : "Input tidak valid" });
      return;
    }
    setRowBusy(item.id);
    try {
      const row = await updateProfileStat(supabaseBrowser(), item.id, validated);
      setItems((prev) =>
        prev.map((p) => (p.id === item.id ? row : p)).sort((a, b) => a.sort - b.sort),
      );
      setEditingId(null);
    } catch {
      setRowError({ id: item.id, message: "Gagal menyimpan perubahan. Coba lagi." });
    } finally {
      setRowBusy(null);
    }
  }

  async function onDelete(item: ProfileStatRow) {
    if (rowBusy) return;
    setRowError(null);
    setRowBusy(item.id);
    try {
      await deleteProfileStat(supabaseBrowser(), item.id);
      setItems((prev) => prev.filter((p) => p.id !== item.id));
      if (editingId === item.id) setEditingId(null);
    } catch {
      setRowError({ id: item.id, message: "Gagal menghapus stat. Coba lagi." });
    } finally {
      setRowBusy(null);
    }
  }

  if (loading) {
    return <p className="mt-3 text-sm text-neutral-600">Memuat stat…</p>;
  }

  const displayedIds = new Set(resolveDisplayedStats(items).map((item) => item.id));

  return (
    <div className="mt-4">
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <details className="rounded-xl border border-neutral-200 bg-white">
        <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-bold hover:bg-neutral-50">Tambah pencapaian</summary>
        <form onSubmit={onCreate} onChange={() => setCreated(false)} className="space-y-3 border-t border-neutral-200 p-4">
          <fieldset disabled={saving} className="min-w-0 space-y-3 disabled:opacity-70">
            <legend className="sr-only">Tambah pencapaian</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">Nilai (maks 40 karakter)</span>
                <input
                  type="text"
                  required
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  maxLength={40}
                  placeholder="mis. 10+ Tahun"
                  className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Label (maks 40 karakter)</span>
                <input
                  type="text"
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={40}
                  placeholder="mis. Pengalaman"
                  className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Urutan</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  required
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex min-h-11 items-center gap-2 self-end">
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => setVisible(e.target.checked)}
                  className="h-4 w-4 accent-espresso"
                />
                <span className="text-sm font-medium">Tampilkan di landing</span>
              </label>
            </div>
            {formError ? (
              <p role="alert" className="text-sm text-red-600">
                {formError}
              </p>
            ) : null}
          </fieldset>
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-neutral-200 pt-3">
            {created ? <p role="status" className="mr-auto text-sm text-green-800">Pencapaian ditambahkan.</p> : null}
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
            >
              {saving ? "Menyimpan…" : "Simpan pencapaian"}
            </button>
          </div>
        </form>
      </details>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari pencapaian…"
        aria-label="Cari pencapaian"
        className="mt-4 min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
      />
      <ul className="mt-4 space-y-2">
        {filteredItems.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-neutral-200 bg-white p-3"
          >
            <div className="min-w-0 flex-1">
              {editingId === item.id ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="block min-w-0">
                    <span className="text-sm font-medium">Nilai</span>
                    <input
                      type="text"
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      maxLength={40}
                      className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="text-sm font-medium">Label</span>
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      maxLength={40}
                      className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="text-sm font-medium">Urutan</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={editSort}
                      onChange={(e) => setEditSort(e.target.value)}
                      className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-neutral-800">
                    {item.value} <span className="font-normal">· {item.label}</span>
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    urutan {item.sort} ·{" "}
                    {item.visible
                      ? displayedIds.has(item.id) ? "Tampil di situs" : "Di luar batas tampilan"
                      : "Disembunyikan"}
                  </p>
                </>
              )}
            </div>
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
                <button
                  type="button"
                  disabled={rowBusy === item.id}
                  onClick={() => onToggleVisible(item)}
                  className="min-h-10 rounded-full border border-neutral-300 px-3 text-sm font-semibold hover:bg-neutral-100 disabled:opacity-60"
                >
                  {item.visible ? "Sembunyikan" : "Tampilkan"}
                </button>
              ) : null}
              {editingId !== item.id ? (
                <ConfirmAction
                  label="Hapus pencapaian"
                  title={`Hapus pencapaian ${item.label}?`}
                  description="Pencapaian ini akan dihapus dari profil publik."
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
        <p className="mt-3 text-sm text-neutral-600">
          Belum ada pencapaian. Pilih Tambah pencapaian untuk memulai.
        </p>
      ) : null}
      {items.length > 0 && filteredItems.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-600">
          {`Tidak ada hasil untuk "${query.trim()}".`}
        </p>
      ) : null}
    </div>
  );
}
