"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmAction } from "@/components/admin/confirm-action";
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
  const [created, setCreated] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuote, setEditQuote] = useState("");
  const [editClientName, setEditClientName] = useState("");
  const [editSort, setEditSort] = useState("0");
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [query, setQuery] = useState("");

  // Client-side search over visible text fields only; CRUD/data flow
  // below is unchanged.
  const filteredItems = useMemo(
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
    setCreated(false);
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
      setQuery("");
      setCreated(true);
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
      setRowError({ id: item.id, message: "Gagal mengubah visibilitas. Coba lagi." });
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
      setRowError({ id: item.id, message: err instanceof Error ? err.message : "Input tidak valid" });
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
      setRowError({ id: item.id, message: "Gagal menyimpan perubahan. Coba lagi." });
    } finally {
      setRowBusy(null);
    }
  }

  async function onDelete(item: TestimonialRow) {
    if (rowBusy) return;
    setRowError(null);
    setRowBusy(item.id);
    try {
      await deleteTestimonial(supabaseBrowser(), item.id);
      setItems((prev) => prev.filter((p) => p.id !== item.id));
      if (editingId === item.id) setEditingId(null);
    } catch {
      setRowError({ id: item.id, message: "Gagal menghapus testimoni. Coba lagi." });
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

      <details className="rounded-xl border border-neutral-200 bg-white">
        <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-bold hover:bg-neutral-50">Tambah testimoni</summary>
        <form onSubmit={onCreate} onChange={() => setCreated(false)} className="space-y-3 border-t border-neutral-200 p-4">
          <fieldset disabled={saving} className="min-w-0 space-y-3 disabled:opacity-70">
            <legend className="sr-only">Tambah testimoni</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium">Kutipan (maks 300 karakter)</span>
                <textarea
                  required
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  maxLength={300}
                  placeholder="mis. Riasannya natural tapi tahan lama."
                  className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
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
            {created ? <p role="status" className="mr-auto text-sm text-green-800">Testimoni ditambahkan.</p> : null}
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
            >
              {saving ? "Menyimpan…" : "Simpan testimoni"}
            </button>
          </div>
        </form>
      </details>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari testimoni…"
        aria-label="Cari testimoni"
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
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block min-w-0 sm:col-span-2">
                    <span className="text-sm font-medium">Kutipan</span>
                    <textarea
                      autoFocus
                      value={editQuote}
                      onChange={(e) => setEditQuote(e.target.value)}
                      maxLength={300}
                      rows={2}
                      className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="text-sm font-medium">Nama klien</span>
                    <input
                      type="text"
                      value={editClientName}
                      onChange={(e) => setEditClientName(e.target.value)}
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
                  <p className="text-sm text-neutral-800">“{item.quote}”</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {item.client_name} · urutan {item.sort} ·{" "}
                    {item.visible ? "tampil" : "disembunyikan"}
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
                  label="Hapus testimoni"
                  title={`Hapus testimoni ${item.client_name}?`}
                  description="Testimoni ini akan dihapus dari profil publik."
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
          Belum ada testimoni — tambah review pertama di atas.
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
