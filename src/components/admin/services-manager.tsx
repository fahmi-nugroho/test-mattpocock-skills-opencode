"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { filterByQuery } from "@/lib/admin/filter-items";
import { notifyServiceCatalogChanged } from "@/lib/admin/service-catalog-events";
import { validateServiceInput } from "@/lib/admin/validate-service";
import { checkImageFile } from "@/lib/admin/validate-image";
import { parseRequiredNumber } from "@/lib/admin/form-number";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  deleteImageBestEffort,
  uploadAdminImage,
} from "@/lib/supabase/admin-storage";
import {
  createService,
  deleteService,
  listServicesAdmin,
  updateService,
} from "@/lib/supabase/admin-services";
import type { Service } from "@/lib/supabase/database";
import { formatIDR } from "@/lib/format";
import { FEATURED_BADGE_LABEL, getFeaturedService } from "@/lib/featured-service";

/**
 * Price/service CRUD manager for the admin dashboard (ticket 06).
 * Single optional cover upload to the `prices/` bucket; name,
 * description, IDR price, duration, active flag, sort. Reads the same
 * `services` table the public price list reads, so saved changes
 * appear on the landing on next load.
 */
export function ServicesManager() {
  const [items, setItems] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [active, setActive] = useState(true);
  const [sort, setSort] = useState("0");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editSort, setEditSort] = useState("0");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Client-side search over visible text fields only; CRUD/data flow
  // below is unchanged.
  const visibleItems = useMemo(
    () =>
      filterByQuery(items, query, (item) => [item.name, item.description]),
    [items, query],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listServicesAdmin(supabaseBrowser());
        if (!cancelled) setItems(rows);
      } catch {
        if (!cancelled) setError("Gagal memuat harga & layanan. Coba lagi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (saving) return;
    setFormError(null);
    setCreated(false);
    let validated;
    try {
      validated = validateServiceInput({
        name,
        description,
        price_idr: parseRequiredNumber(price, "Harga"),
        duration_min: parseRequiredNumber(duration, "Durasi"),
        active,
        sort: parseRequiredNumber(sort, "Urutan"),
      });
      if (file) checkImageFile(file);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Input tidak valid");
      return;
    }
    setSaving(true);
    let uploaded: string | null = null;
    try {
      const supabase = supabaseBrowser();
      if (file) {
        uploaded = await uploadAdminImage(supabase, "prices", file, "jpg");
      }
      const row = await createService(supabase, {
        ...validated,
        cover_image_url: uploaded,
      });
      setItems((prev) => [...prev, row].sort((a, b) => a.sort - b.sort));
      notifyServiceCatalogChanged();
      setQuery("");
      setCreated(true);
      setName("");
      setDescription("");
      setPrice("");
      setDuration("");
      setActive(true);
      setSort("0");
      setFile(null);
      form.reset();
    } catch {
      // Row insert failed after upload: prune the orphan so a retry
      // doesn't leak storage objects (best-effort).
      if (uploaded) {
        await deleteImageBestEffort(supabaseBrowser(), "prices", uploaded);
      }
      setFormError("Gagal menyimpan layanan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  async function onToggleActive(item: Service) {
    if (rowBusy) return;
    setRowError(null);
    setRowBusy(item.id);
    try {
      const row = await updateService(supabaseBrowser(), item.id, {
        active: !item.active,
      });
      setItems((prev) => prev.map((p) => (p.id === item.id ? row : p)));
    } catch {
      setRowError({ id: item.id, message: "Gagal mengubah status aktif. Coba lagi." });
    } finally {
      setRowBusy(null);
    }
  }

  function startEdit(item: Service) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditDescription(item.description);
    setEditPrice(String(item.price_idr));
    setEditDuration(String(item.duration_min));
    setEditSort(String(item.sort));
    setEditFile(null);
    setRowError(null);
  }

  async function onSaveEdit(item: Service) {
    if (rowBusy) return;
    setRowError(null);
    let validated;
    try {
      validated = validateServiceInput({
        name: editName,
        description: editDescription,
        price_idr: parseRequiredNumber(editPrice, "Harga"),
        duration_min: parseRequiredNumber(editDuration, "Durasi"),
        active: item.active,
        sort: parseRequiredNumber(editSort, "Urutan"),
      });
      if (editFile) checkImageFile(editFile);
    } catch (err) {
      setRowError({ id: item.id, message: err instanceof Error ? err.message : "Input tidak valid" });
      return;
    }
    setRowBusy(item.id);
    let uploadedNew: string | null = null;
    try {
      const supabase = supabaseBrowser();
      let coverUrl = item.cover_image_url;
      if (editFile) {
        uploadedNew = await uploadAdminImage(supabase, "prices", editFile, "jpg");
        coverUrl = uploadedNew;
      }
      const row = await updateService(supabase, item.id, {
        ...validated,
        cover_image_url: coverUrl,
      });
      if (editFile && item.cover_image_url) {
        // Cover replaced: prune the previous object, best-effort.
        await deleteImageBestEffort(supabase, "prices", item.cover_image_url);
      }
      setItems((prev) =>
        prev.map((p) => (p.id === item.id ? row : p)).sort((a, b) => a.sort - b.sort),
      );
      notifyServiceCatalogChanged();
      setEditingId(null);
    } catch {
      // Update failed after a replacement upload: prune the new object
      // so it doesn't leak (best-effort); the old cover stays live.
      if (uploadedNew) {
        await deleteImageBestEffort(supabaseBrowser(), "prices", uploadedNew);
      }
      setRowError({ id: item.id, message: "Gagal menyimpan perubahan. Coba lagi." });
    } finally {
      setRowBusy(null);
    }
  }

  async function onRemoveCover(item: Service) {
    if (rowBusy || !item.cover_image_url) return;
    setRowError(null);
    setRowBusy(item.id);
    try {
      const supabase = supabaseBrowser();
      const row = await updateService(supabase, item.id, {
        cover_image_url: null,
      });
      await deleteImageBestEffort(supabase, "prices", item.cover_image_url);
      setItems((prev) => prev.map((p) => (p.id === item.id ? row : p)));
    } catch {
      setRowError({ id: item.id, message: "Gagal menghapus cover. Coba lagi." });
    } finally {
      setRowBusy(null);
    }
  }

  async function onDelete(item: Service) {
    if (rowBusy) return;
    setRowError(null);
    setNotice(null);
    setRowBusy(item.id);
    try {
      const { cleanupOk } = await deleteService(
        supabaseBrowser(),
        item.id,
        item.cover_image_url,
      );
      setItems((prev) => prev.filter((p) => p.id !== item.id));
      notifyServiceCatalogChanged();
      if (editingId === item.id) setEditingId(null);
      if (!cleanupOk) {
        setNotice(
          "Layanan dihapus, tapi cover lama gagal dibersihkan dari penyimpanan.",
        );
      }
    } catch {
      setRowError({ id: item.id, message: "Gagal menghapus layanan. Coba lagi." });
    } finally {
      setRowBusy(null);
    }
  }

  if (loading) {
    return <p className="mt-3 text-sm text-neutral-600">Memuat harga…</p>;
  }

  const featuredId = getFeaturedService(items)?.id;

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

      <p id="service-sort-hint" className="mb-3 text-sm text-neutral-600">
        Nomor urutan yang lebih kecil tampil lebih dulu. Layanan aktif pertama menjadi Layanan unggulan.
      </p>
      <details className="rounded-xl border border-neutral-200 bg-white">
        <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-bold hover:bg-neutral-50">Tambah layanan</summary>
        <form onSubmit={onCreate} onChange={() => setCreated(false)} className="space-y-3 border-t border-neutral-200 p-4">
          <fieldset disabled={saving} className="min-w-0 space-y-3 disabled:opacity-70">
            <legend className="sr-only">Tambah layanan</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">Nama layanan</span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="mis. Makeup Wisuda"
                  className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>
              <div className="sm:col-span-2">
                <label htmlFor="service-description" className="text-sm font-medium">Deskripsi</label>
                <p id="service-description-hint" className="mt-0.5 text-sm text-neutral-600">
                  Tulis isi paket dan biaya tambahan yang berlaku. Gunakan satu baris per poin.
                </p>
                <textarea
                  id="service-description"
                  rows={3}
                  aria-describedby="service-description-hint"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <label className="block">
                <span className="text-sm font-medium">Harga (IDR)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="500000"
                  className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Durasi (menit)</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="120"
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
                  aria-describedby="service-sort-hint"
                  onChange={(e) => setSort(e.target.value)}
                  className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex min-h-11 items-center gap-2 self-end">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 accent-espresso"
                />
                <span className="text-sm font-medium">Aktif di landing</span>
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium">Cover (opsional, maks 5 MB)</span>
              <input
                type="file"
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
            {created ? <p role="status" className="mr-auto text-sm text-green-800">Layanan ditambahkan.</p> : null}
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
            >
              {saving ? "Menyimpan…" : "Simpan layanan"}
            </button>
          </div>
        </form>
      </details>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari layanan…"
        aria-label="Cari layanan"
        className="mt-4 min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
      />
      <ul className="mt-4 space-y-2">
        {visibleItems.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-neutral-200 bg-white p-3"
          >
            <div className="flex items-start gap-3">
              {item.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.cover_image_url}
                  alt=""
                  className="h-16 w-24 rounded-lg bg-neutral-100 object-cover"
                  loading="lazy"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                {editingId === item.id ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block min-w-0">
                      <span className="text-sm font-medium">Nama layanan</span>
                      <input
                        type="text"
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <div className="min-w-0 sm:col-span-2">
                      <label htmlFor="service-edit-description" className="text-sm font-medium">Deskripsi</label>
                      <p id="service-edit-description-hint" className="mt-0.5 text-sm text-neutral-600">
                        Tulis isi paket dan biaya tambahan yang berlaku. Gunakan satu baris per poin.
                      </p>
                      <textarea
                        id="service-edit-description"
                        rows={3}
                        aria-describedby="service-edit-description-hint"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <label className="block min-w-0">
                      <span className="text-sm font-medium">Harga (IDR)</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="text-sm font-medium">Durasi (menit)</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
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
                        aria-describedby="service-sort-hint"
                        onChange={(e) => setEditSort(e.target.value)}
                        className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="text-sm font-medium">Ganti cover (opsional)</span>
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
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-neutral-500">
                      {formatIDR(item.price_idr)} · {item.duration_min} menit ·
                      urutan {item.sort} · {item.active ? "aktif" : "nonaktif"}
                    </p>
                    {item.id === featuredId ? (
                      <p className="mt-1 text-xs font-semibold text-gold-deep">{FEATURED_BADGE_LABEL}</p>
                    ) : null}
                    {item.description ? (
                      <p className="mt-1 whitespace-pre-line break-words text-sm text-neutral-600">
                        {item.description}
                      </p>
                    ) : null}
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
                  onClick={() => onToggleActive(item)}
                  className="min-h-10 rounded-full border border-neutral-300 px-3 text-sm font-semibold hover:bg-neutral-100 disabled:opacity-60"
                >
                  {item.active ? "Nonaktifkan" : "Aktifkan"}
                </button>
              ) : null}
              {item.cover_image_url && editingId !== item.id ? (
                <ConfirmAction
                  label="Hapus cover"
                  title={`Hapus cover ${item.name}?`}
                  description="Layanan tetap tampil sesuai statusnya. Foto cover akan dihapus."
                  onConfirm={() => onRemoveCover(item)}
                  disabled={rowBusy !== null}
                  destructive
                />
              ) : null}
              {editingId !== item.id ? (
                <ConfirmAction
                  label="Hapus layanan"
                  title={`Hapus layanan ${item.name}?`}
                  description="Layanan ini akan dihapus dari daftar harga publik."
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
          Belum ada layanan — tambah harga pertama di atas.
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
