"use client";

import { useEffect, useState } from "react";
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
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editSort, setEditSort] = useState("0");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
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
      setName("");
      setDescription("");
      setPrice("");
      setDuration("");
      setActive(true);
      setSort("0");
      setFile(null);
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
      setRowError("Gagal mengubah status aktif. Coba lagi.");
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
      setRowError(err instanceof Error ? err.message : "Input tidak valid");
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
      setEditingId(null);
    } catch {
      // Update failed after a replacement upload: prune the new object
      // so it doesn't leak (best-effort); the old cover stays live.
      if (uploadedNew) {
        await deleteImageBestEffort(supabaseBrowser(), "prices", uploadedNew);
      }
      setRowError("Gagal menyimpan perubahan. Coba lagi.");
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
      setRowError("Gagal menghapus cover. Coba lagi.");
    } finally {
      setRowBusy(null);
    }
  }

  async function onDelete(item: Service) {
    if (confirmDeleteId !== item.id) {
      setConfirmDeleteId(item.id);
      return;
    }
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
      setConfirmDeleteId(null);
      if (editingId === item.id) setEditingId(null);
      if (!cleanupOk) {
        setNotice(
          "Layanan dihapus, tapi cover lama gagal dibersihkan dari penyimpanan.",
        );
      }
    } catch {
      setRowError("Gagal menghapus layanan. Coba lagi.");
    } finally {
      setRowBusy(null);
    }
  }

  if (loading) {
    return <p className="mt-3 text-sm text-neutral-600">Memuat harga…</p>;
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
        <h3 className="text-sm font-bold">Tambah layanan</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Nama layanan</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Makeup Wisuda"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Deskripsi</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
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
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
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
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4"
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
          {saving ? "Menyimpan…" : "Tambah layanan"}
        </button>
      </form>

      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-neutral-200 bg-white p-4"
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
                    <input
                      type="text"
                      aria-label="Nama layanan"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      type="text"
                      aria-label="Deskripsi"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      type="number"
                      aria-label="Harga (IDR)"
                      min={0}
                      step={1}
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      type="number"
                      aria-label="Durasi (menit)"
                      min={1}
                      step={1}
                      value={editDuration}
                      onChange={(e) => setEditDuration(e.target.value)}
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
                      aria-label="Ganti cover (opsional)"
                      accept="image/*"
                      onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
                      className="text-xs"
                    />
                  </div>
                ) : (
                  <>
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-neutral-500">
                      {formatIDR(item.price_idr)} · {item.duration_min} menit ·
                      urutan {item.sort} · {item.active ? "aktif" : "nonaktif"}
                    </p>
                    {item.description ? (
                      <p className="mt-1 truncate text-xs text-neutral-600">
                        {item.description}
                      </p>
                    ) : null}
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
                onClick={() => onToggleActive(item)}
                className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold disabled:opacity-60"
              >
                {item.active ? "Nonaktifkan" : "Aktifkan"}
              </button>
              {item.cover_image_url && editingId !== item.id ? (
                <button
                  type="button"
                  disabled={rowBusy === item.id}
                  onClick={() => onRemoveCover(item)}
                  className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold disabled:opacity-60"
                >
                  Hapus cover
                </button>
              ) : null}
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
          Belum ada layanan — tambah harga pertama di atas.
        </p>
      ) : null}
    </div>
  );
}
