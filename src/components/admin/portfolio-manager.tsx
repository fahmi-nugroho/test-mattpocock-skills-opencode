"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { filterByQuery } from "@/lib/admin/filter-items";
import { MAX_CATEGORIES } from "@/lib/portfolio";
import { validatePortfolioInput } from "@/lib/admin/validate-portfolio";
import { checkImageFile } from "@/lib/admin/validate-image";
import { parseRequiredNumber } from "@/lib/admin/form-number";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  deleteImageBestEffort,
  uploadAdminImage,
} from "@/lib/supabase/admin-storage";
import {
  createPortfolioItem,
  deletePortfolioItem,
  listPortfolioItemsAdmin,
  updatePortfolioItem,
} from "@/lib/supabase/admin-portfolio";
import type { PortfolioItem } from "@/lib/supabase/database";

/**
 * Portfolio CRUD manager for the admin dashboard (ticket 06).
 * Creates upload to the `portfolio/` bucket, edits title/category/
 * sort/visible, and deletes rows with storage cleanup. Reads the same
 * `portfolio_items` table the public landing grid reads, so saved
 * changes appear on the landing on next load.
 */
export function PortfolioManager() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("0");
  const [visible, setVisible] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSort, setEditSort] = useState("0");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Client-side search over visible text fields only; CRUD/data flow
  // below is unchanged.
  const visibleItems = useMemo(
    () => filterByQuery(items, query, (item) => [item.title, item.category]),
    [items, query],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listPortfolioItemsAdmin(supabaseBrowser());
        if (!cancelled) setItems(rows);
      } catch {
        if (!cancelled) setError("Gagal memuat portfolio. Coba lagi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const distinctCategories = Array.from(new Set(items.map((i) => i.category)));

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (saving) return;
    setFormError(null);
    setCreated(false);
    let validated;
    try {
      validated = validatePortfolioInput({
        title,
        category,
        sort: parseRequiredNumber(sort, "Urutan"),
        visible,
      });
      if (!file) throw new Error("Pilih gambar portfolio terlebih dahulu");
      checkImageFile(file);
      if (
        !distinctCategories.includes(validated.category) &&
        distinctCategories.length >= MAX_CATEGORIES
      ) {
        throw new Error(`Maksimal ${MAX_CATEGORIES} kategori portfolio`);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Input tidak valid");
      return;
    }
    setSaving(true);
    let uploaded: string | null = null;
    try {
      const supabase = supabaseBrowser();
      uploaded = await uploadAdminImage(supabase, "portfolio", file, "jpg");
      const row = await createPortfolioItem(supabase, {
        ...validated,
        image_url: uploaded,
      });
      setItems((prev) => [...prev, row].sort((a, b) => a.sort - b.sort));
      setQuery("");
      setCreated(true);
      setTitle("");
      setCategory("");
      setSort("0");
      setVisible(true);
      setFile(null);
      form.reset();
    } catch {
      // Row insert failed after upload: prune the orphan so a retry
      // doesn't leak storage objects (best-effort).
      if (uploaded) {
        await deleteImageBestEffort(supabaseBrowser(), "portfolio", uploaded);
      }
      setFormError("Gagal menyimpan portfolio. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  async function onToggleVisible(item: PortfolioItem) {
    if (rowBusy) return;
    setRowError(null);
    setRowBusy(item.id);
    try {
      const row = await updatePortfolioItem(supabaseBrowser(), item.id, {
        visible: !item.visible,
      });
      setItems((prev) => prev.map((p) => (p.id === item.id ? row : p)));
    } catch {
      setRowError({ id: item.id, message: "Gagal mengubah visibilitas. Coba lagi." });
    } finally {
      setRowBusy(null);
    }
  }

  function startEdit(item: PortfolioItem) {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditCategory(item.category);
    setEditSort(String(item.sort));
    setEditFile(null);
    setRowError(null);
  }

  async function onSaveEdit(item: PortfolioItem) {
    if (rowBusy) return;
    setRowError(null);
    let validated;
    try {
      validated = validatePortfolioInput({
        title: editTitle,
        category: editCategory,
        sort: parseRequiredNumber(editSort, "Urutan"),
        visible: item.visible,
      });
      if (editFile) checkImageFile(editFile);
      // Cap counts distinct categories across the OTHER rows plus the new
      // value: the edited row's old category may still be shared, so it
      // must not be dropped from the count by name comparison.
      const others = Array.from(
        new Set(
          items.filter((i) => i.id !== item.id).map((i) => i.category),
        ),
      );
      if (!others.includes(validated.category) && others.length >= MAX_CATEGORIES) {
        throw new Error(`Maksimal ${MAX_CATEGORIES} kategori portfolio`);
      }
    } catch (err) {
      setRowError({ id: item.id, message: err instanceof Error ? err.message : "Input tidak valid" });
      return;
    }
    setRowBusy(item.id);
    let uploadedNew: string | null = null;
    try {
      const supabase = supabaseBrowser();
      let imageUrl = item.image_url;
      if (editFile) {
        uploadedNew = await uploadAdminImage(supabase, "portfolio", editFile, "jpg");
        imageUrl = uploadedNew;
      }
      const row = await updatePortfolioItem(supabase, item.id, {
        ...validated,
        image_url: imageUrl,
      });
      if (editFile) {
        // Old tile replaced: prune the previous object, best-effort.
        await deleteImageBestEffort(supabase, "portfolio", item.image_url);
      }
      setItems((prev) =>
        prev.map((p) => (p.id === item.id ? row : p)).sort((a, b) => a.sort - b.sort),
      );
      setEditingId(null);
    } catch {
      // Update failed after a replacement upload: prune the new object
      // so it doesn't leak (best-effort); the old image stays live.
      if (uploadedNew) {
        await deleteImageBestEffort(supabaseBrowser(), "portfolio", uploadedNew);
      }
      setRowError({ id: item.id, message: "Gagal menyimpan perubahan. Coba lagi." });
    } finally {
      setRowBusy(null);
    }
  }

  async function onDelete(item: PortfolioItem) {
    if (rowBusy) return;
    setRowError(null);
    setNotice(null);
    setRowBusy(item.id);
    try {
      const { cleanupOk } = await deletePortfolioItem(
        supabaseBrowser(),
        item.id,
        item.image_url,
      );
      setItems((prev) => prev.filter((p) => p.id !== item.id));
      if (editingId === item.id) setEditingId(null);
      if (!cleanupOk) {
        setNotice(
          "Portfolio dihapus, tapi gambar lama gagal dibersihkan dari penyimpanan.",
        );
      }
    } catch {
      setRowError({ id: item.id, message: "Gagal menghapus portfolio. Coba lagi." });
    } finally {
      setRowBusy(null);
    }
  }

  if (loading) {
    return <p className="mt-3 text-sm text-neutral-600">Memuat portfolio…</p>;
  }

  return (
    <div className="mt-4">
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-2 text-sm text-amber-700">
          {notice}
        </p>
      ) : null}

      <details className="rounded-xl border border-neutral-200 bg-white">
        <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-bold hover:bg-neutral-50">Tambah karya</summary>
        <form onSubmit={onCreate} onChange={() => setCreated(false)} className="space-y-3 border-t border-neutral-200 p-4">
          <fieldset disabled={saving} className="min-w-0 space-y-3 disabled:opacity-70">
            <legend className="sr-only">Tambah karya</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">Judul</span>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">
                  Kategori ({distinctCategories.length}/{MAX_CATEGORIES})
                </span>
                <input
                  type="text"
                  required
                  list="portfolio-categories"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="mis. Wedding"
                  className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                <datalist id="portfolio-categories">
                  {distinctCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
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
            <label className="block">
              <span className="text-sm font-medium">Gambar (wajib, maks 5 MB)</span>
              <input
                type="file"
                required
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full min-w-0 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:font-semibold"
              />
            </label>
            {formError ? (
              <p role="alert" className="text-sm text-red-600">
                {formError}
              </p>
            ) : null}
          </fieldset>
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-neutral-200 pt-3">
            {created ? <p role="status" className="mr-auto text-sm text-green-800">Karya ditambahkan.</p> : null}
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
            >
              {saving ? "Menyimpan…" : "Simpan karya"}
            </button>
          </div>
        </form>
      </details>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari portfolio…"
        aria-label="Cari portfolio"
        className="mt-4 min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
      />
      <ul className="mt-4 space-y-2">
        {visibleItems.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-neutral-200 bg-white p-3"
          >
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image_url}
                alt=""
                className="h-16 w-12 shrink-0 rounded-lg bg-neutral-100 object-cover"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                {editingId === item.id ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="block min-w-0">
                      <span className="text-sm font-medium">Judul</span>
                      <input
                        type="text"
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="text-sm font-medium">Kategori</span>
                      <input
                        type="text"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
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
                    <label className="block min-w-0 sm:col-span-3">
                      <span className="text-sm font-medium">Ganti gambar (opsional)</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
                        className="mt-1 block w-full min-w-0 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:font-semibold"
                      />
                    </label>
                  </div>
                ) : (
                  <>
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-neutral-500">
                      {item.category} · urutan {item.sort} ·{" "}
                      {item.visible ? "tampil" : "disembunyikan"}
                    </p>
                  </>
                )}
              </div>
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
                  label="Hapus karya"
                  title={`Hapus karya ${item.title}?`}
                  description="Karya ini akan dihapus dari portfolio publik."
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
          Belum ada portfolio — tambah karya pertama di atas.
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
