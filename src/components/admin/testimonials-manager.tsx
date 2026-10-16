"use client";

import { useEffect, useMemo, useState } from "react";
import { filterByQuery } from "@/lib/admin/filter-items";
import { validateTestimonialInput } from "@/lib/admin/validate-testimonial";
import { parseRequiredNumber } from "@/lib/admin/form-number";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  createTestimonial,
  deleteTestimonial,
  listTestimonialsAdmin,
  updateTestimonial,
} from "@/lib/supabase/admin-testimonials";
import type { TestimonialRow } from "@/lib/supabase/database";

/**
 * Testimonial CRUD manager for the admin dashboard (ticket 02).
 * Text-only rows (quote + client name): no image upload or storage
 * cleanup, unlike portfolio/services. Creates/edits sort + visible,
 * toggles visibility, deletes with confirm. Reads the same
 * `testimonials` table the public landing reads, so saved changes appear
 * on the landing on next load.
 */
export function TestimonialsManager() {
  const [items, setItems] = useState<TestimonialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState("");
  const [clientName, setClientName] = useState("");
  const [sort, setSort] = useState("0");
  const [visible, setVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuote, setEditQuote] = useState("");
  const [editClientName, setEditClientName] = useState("");
  const [editSort, setEditSort] = useState("0");
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Client-side search over visible text fields only; CRUD/data flow
  // below is unchanged.
  const visibleItems = useMemo(
    () =>
      filterByQuery(items, query, (item) => [item.quote, item.client_name]),
    [items, query],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listTestimonialsAdmin(supabaseBrowser());
        if (!cancelled) setItems(rows);
      } catch {
        if (!cancelled) setError("Gagal memuat testimoni. Coba lagi.");
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
    let validated;
    try {
      validated = validateTestimonialInput({
        quote,
        client_name: clientName,
        sort: parseRequiredNumber(sort, "Urutan"),
        visible,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Input tidak valid");
      return;
    }
    setSaving(true);
    try {
      const row = await createTestimonial(supabaseBrowser(), validated);
      setItems((prev) => [...prev, row].sort((a, b) => a.sort - b.sort));
      setQuote("");
      setClientName("");
      setSort("0");
      setVisible(true);
    } catch {
      setFormError("Gagal menyimpan testimoni. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  async function onToggleVisible(item: TestimonialRow) {
    if (rowBusy) return;
    setRowError(null);
    setRowBusy(item.id);
    try {
      const row = await updateTestimonial(supabaseBrowser(), item.id, {
        visible: !item.visible,
      });
      setItems((prev) => prev.map((p) => (p.id === item.id ? row : p)));
    } catch {
      setRowError("Gagal mengubah visibilitas. Coba lagi.");
    } finally {
      setRowBusy(null);
    }
  }

  function startEdit(item: TestimonialRow) {
    setEditingId(item.id);
    setEditQuote(item.quote);
    setEditClientName(item.client_name);
    setEditSort(String(item.sort));
    setRowError(null);
  }

  async function onSaveEdit(item: TestimonialRow) {
    if (rowBusy) return;
    setRowError(null);
    let validated;
    try {
      validated = validateTestimonialInput({
        quote: editQuote,
        client_name: editClientName,
        sort: parseRequiredNumber(editSort, "Urutan"),
        visible: item.visible,
      });
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Input tidak valid");
      return;
    }
    setRowBusy(item.id);
    try {
      const row = await updateTestimonial(supabaseBrowser(), item.id, validated);
      setItems((prev) =>
        prev.map((p) => (p.id === item.id ? row : p)).sort((a, b) => a.sort - b.sort),
      );
      setEditingId(null);
    } catch {
      setRowError("Gagal menyimpan perubahan. Coba lagi.");
    } finally {
      setRowBusy(null);
    }
  }

  async function onDelete(item: TestimonialRow) {
    if (confirmDeleteId !== item.id) {
      setConfirmDeleteId(item.id);
      return;
    }
    if (rowBusy) return;
    setRowError(null);
    setNotice(null);
    setRowBusy(item.id);
    try {
      await deleteTestimonial(supabaseBrowser(), item.id);
      setItems((prev) => prev.filter((p) => p.id !== item.id));
      setConfirmDeleteId(null);
      if (editingId === item.id) setEditingId(null);
    } catch {
      setRowError("Gagal menghapus testimoni. Coba lagi.");
    } finally {
      setRowBusy(null);
    }
  }

  if (loading) {
    return <p className="mt-3 text-sm text-neutral-600">Memuat testimoni…</p>;
  }

  return (
    <div className="mt-4">
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {rowError ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {rowError}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-2 text-sm text-amber-700">
          {notice}
        </p>
      ) : null}

      <form onSubmit={onCreate} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="text-sm font-bold">Tambah testimoni</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Kutipan (maks 300 karakter)</span>
            <textarea
              required
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              maxLength={300}
              placeholder="mis. Riasannya natural tapi tahan lama."
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              rows={2}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Nama klien</span>
            <input
              type="text"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="mis. Dinda, Pengantin"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
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
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-end gap-2 pb-2">
            <input
              type="checkbox"
              checked={visible}
              onChange={(e) => setVisible(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium">Tampilkan di landing</span>
          </label>
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
          {saving ? "Menyimpan…" : "Tambah testimoni"}
        </button>
      </form>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari testimoni…"
        aria-label="Cari testimoni"
        className="mt-4 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
      />
      <ul className="mt-4 space-y-2">
        {visibleItems.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-neutral-200 bg-white p-3"
          >
            <div className="min-w-0 flex-1">
              {editingId === item.id ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <textarea
                    aria-label="Kutipan"
                    value={editQuote}
                    onChange={(e) => setEditQuote(e.target.value)}
                    maxLength={300}
                    rows={2}
                    className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm sm:col-span-2"
                  />
                  <input
                    type="text"
                    aria-label="Nama klien"
                    value={editClientName}
                    onChange={(e) => setEditClientName(e.target.value)}
                    className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    aria-label="Urutan"
                    min={0}
                    step={1}
                    value={editSort}
                    onChange={(e) => setEditSort(e.target.value)}
                    className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                </div>
              ) : (
                <>
                  <p className="text-sm text-neutral-800">“{item.quote}”</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {item.client_name} · urutan {item.sort} ·{" "}
                    {item.visible ? "tampil" : "disembunyikan"}
                  </p>
                </>
              )}
            </div>
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
                onClick={() => onToggleVisible(item)}
                className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold disabled:opacity-60"
              >
                {item.visible ? "Sembunyikan" : "Tampilkan"}
              </button>
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
        <p className="mt-3 text-sm text-neutral-600">
          Belum ada testimoni — tambah review pertama di atas.
        </p>
      ) : null}
      {items.length > 0 && visibleItems.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-600">
          {`Tidak ada hasil untuk "${query.trim()}".`}
        </p>
      ) : null}
    </div>
  );
}
