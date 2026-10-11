"use client";

import { useEffect, useState } from "react";
import { MAX_CATEGORIES } from "@/lib/portfolio";
import { validatePortfolioInput } from "@/lib/admin/validate-portfolio";
import { parseRequiredNumber } from "@/lib/admin/form-number";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  deleteImageByUrl,
  uploadAdminImage,
} from "@/lib/supabase/admin-storage";
import {
  createPortfolioItem,
  deletePortfolioItem,
  listPortfolioItemsAdmin,
  updatePortfolioItem,
} from "@/lib/supabase/admin-portfolio";
import type { PortfolioItem } from "@/lib/supabase/database";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function checkImageFile(file: File): void {
  if (!file.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Ukuran gambar maksimal 5 MB");
  }
}

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
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSort, setEditSort] = useState("0");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
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
      setTitle("");
      setCategory("");
      setSort("0");
      setVisible(true);
      setFile(null);
    } catch {
      // Row insert failed after upload: prune the orphan so a retry
      // doesn't leak storage objects (best-effort).
      if (uploaded) {
        try {
          await deleteImageByUrl(supabaseBrowser(), "portfolio", uploaded);
        } catch {
          // Ignore: orphaned object is harmless, prunable from storage.
        }
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
      setRowError("Gagal mengubah visibilitas. Coba lagi.");
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
      setRowError(err instanceof Error ? err.message : "Input tidak valid");
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
        try {
          await deleteImageByUrl(supabase, "portfolio", item.image_url);
        } catch {
          // Orphaned object is harmless; ignore.
        }
      }
      setItems((prev) =>
        prev.map((p) => (p.id === item.id ? row : p)).sort((a, b) => a.sort - b.sort),
      );
      setEditingId(null);
    } catch {
      // Update failed after a replacement upload: prune the new object
      // so it doesn't leak (best-effort); the old image stays live.
      if (uploadedNew) {
        try {
          await deleteImageByUrl(supabaseBrowser(), "portfolio", uploadedNew);
        } catch {
          // Ignore: orphaned object is harmless, prunable from storage.
        }
      }
      setRowError("Gagal menyimpan perubahan. Coba lagi.");
    } finally {
      setRowBusy(null);
    }
  }

  async function onDelete(item: PortfolioItem) {
    if (confirmDeleteId !== item.id) {
      setConfirmDeleteId(item.id);
      return;
    }
    if (rowBusy) return;
    setRowError(null);
    setRowBusy(item.id);
    try {
      await deletePortfolioItem(supabaseBrowser(), item.id, item.image_url);
      setItems((prev) => prev.filter((p) => p.id !== item.id));
      setConfirmDeleteId(null);
      if (editingId === item.id) setEditingId(null);
    } catch {
      setRowError("Gagal menghapus portfolio. Coba lagi.");
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
      {rowError ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {rowError}
        </p>
      ) : null}

      <form onSubmit={onCreate} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="text-sm font-bold">Tambah portfolio</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Judul</span>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
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
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
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
        <label className="block">
          <span className="text-sm font-medium">Gambar (wajib, maks 5 MB)</span>
          <input
            type="file"
            required
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm"
          />
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
          {saving ? "Menyimpan…" : "Tambah portfolio"}
        </button>
      </form>

      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-neutral-200 bg-white p-4"
          >
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image_url}
                alt=""
                className="h-16 w-12 rounded-lg bg-neutral-100 object-cover"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                {editingId === item.id ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      type="text"
                      aria-label="Judul"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      type="text"
                      aria-label="Kategori"
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
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
                    <input
                      type="file"
                      aria-label="Ganti gambar (opsional)"
                      accept="image/*"
                      onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
                      className="text-xs sm:col-span-3"
                    />
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
          Belum ada portfolio — tambah karya pertama di atas.
        </p>
      ) : null}
    </div>
  );
}
