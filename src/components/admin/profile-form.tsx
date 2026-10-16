"use client";

import { useEffect, useMemo, useState } from "react";
import { validateProfileInput } from "@/lib/admin/validate-profile";
import { checkImageFile } from "@/lib/admin/validate-image";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  getSettings,
  updateProfileSettings,
} from "@/lib/supabase/admin-settings";
import {
  deleteImageBestEffort,
  uploadAdminImage,
} from "@/lib/supabase/admin-storage";

/**
 * Profil form for the admin dashboard (ticket 03). Edits the single-row
 * settings headline/subcopy/portrait: headline max 120, subcopy max 300,
 * portrait via upload (profile/ bucket) with preview plus manual HTTPS
 * URL paste. Replace/remove prunes the previous stored object
 * best-effort so storage does not leak; empty portrait falls back to
 * the first portfolio cover on the landing. Reads/writes the same
 * settings row the public profile RPC reads, so saves appear on next
 * landing load.
 */
export function ProfileForm() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [headline, setHeadline] = useState("");
  const [subcopy, setSubcopy] = useState("");
  const [currentPortrait, setCurrentPortrait] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await getSettings(supabaseBrowser());
        if (cancelled) return;
        setHeadline(settings.headline);
        setSubcopy(settings.subcopy);
        setCurrentPortrait(settings.portrait_url);
        setManualUrl(settings.portrait_url ?? "");
      } catch {
        if (!cancelled) setLoadError("Gagal memuat profil. Coba lagi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Local preview for a newly picked file; revoked when replaced.
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const previewUrl = useMemo(() => {
    if (objectUrl) return objectUrl;
    const manual = manualUrl.trim();
    if (manual) return manual;
    return currentPortrait;
  }, [objectUrl, manualUrl, currentPortrait]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving || removing) return;
    setFormError(null);
    setNotice(null);
    setSaved(false);
    // With a new file picked, the upload replaces the manual URL, so
    // pre-validate only text (portrait_url: null) plus the file itself —
    // a stale typo in the manual field must not block a valid upload.
    // The uploaded URL is validated after the upload (see below).
    if (file) {
      try {
        checkImageFile(file);
        validateProfileInput({
          headline,
          subcopy,
          portrait_url: null,
        });
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Input tidak valid");
        return;
      }
    }
    setSaving(true);
    const supabase = supabaseBrowser();
    const previousPortrait = currentPortrait;
    let uploaded: string | null = null;
    try {
      let portraitUrl = manualUrl;
      if (file) {
        uploaded = await uploadAdminImage(supabase, "profile", file, "jpg");
        portraitUrl = uploaded;
      }
      const validated = validateProfileInput({
        headline,
        subcopy,
        portrait_url: portraitUrl,
      });
      await updateProfileSettings(supabase, validated);
      setHeadline(validated.headline);
      setSubcopy(validated.subcopy);
      setCurrentPortrait(validated.portrait_url);
      setManualUrl(validated.portrait_url ?? "");
      setFile(null);
      setFileInputKey((k) => k + 1);
      // Portrait replaced or cleared: prune the previous stored object,
      // best-effort (foreign/hand-pasted URLs are a no-op).
      if (previousPortrait && previousPortrait !== validated.portrait_url) {
        const ok = await deleteImageBestEffort(
          supabase,
          "profile",
          previousPortrait,
        );
        if (!ok) {
          setNotice(
            "Profil tersimpan, tapi foto lama gagal dibersihkan dari penyimpanan.",
          );
        }
      }
      setSaved(true);
    } catch (err) {
      // Update failed after an upload: prune the new object so it does
      // not leak; the old portrait stays live.
      if (uploaded) {
        await deleteImageBestEffort(supabaseBrowser(), "profile", uploaded);
      }
      if (err instanceof Error && /portrait|headline|subcopy|gambar/i.test(err.message)) {
        setFormError(err.message);
      } else {
        setFormError("Gagal menyimpan profil. Coba lagi.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function onRemovePortrait() {
    if (removing || saving || !currentPortrait) return;
    setFormError(null);
    setNotice(null);
    setSaved(false);
    let validated;
    try {
      validated = validateProfileInput({
        headline,
        subcopy,
        portrait_url: null,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Input tidak valid");
      return;
    }
    setRemoving(true);
    try {
      const supabase = supabaseBrowser();
      const previousPortrait = currentPortrait;
      await updateProfileSettings(supabase, validated);
      setCurrentPortrait(null);
      setManualUrl("");
      setFile(null);
      setFileInputKey((k) => k + 1);
      const ok = await deleteImageBestEffort(
        supabase,
        "profile",
        previousPortrait,
      );
      if (!ok) {
        setNotice(
          "Foto dihapus dari profil, tapi file lama gagal dibersihkan dari penyimpanan.",
        );
      }
      setSaved(true);
    } catch {
      setFormError("Gagal menghapus foto. Coba lagi.");
    } finally {
      setRemoving(false);
    }
  }

  if (loading) {
    return <p className="mt-3 text-sm text-neutral-600">Memuat profil…</p>;
  }

  return (
    <form
      onSubmit={onSave}
      className="mt-4 space-y-3 rounded-xl border border-neutral-200 bg-white p-4"
    >
      <h3 className="text-sm font-bold">Edit profil</h3>
      {loadError ? (
        <p role="alert" className="text-sm text-red-600">
          {loadError}
        </p>
      ) : null}
      <div className="grid gap-3">
        <label className="block">
          <span className="text-sm font-medium">
            Headline (maks 120 karakter)
          </span>
          <input
            type="text"
            required
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={120}
            placeholder="mis. Tampil memukau di hari spesialmu"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">
            Subcopy (maks 300 karakter)
          </span>
          <textarea
            required
            value={subcopy}
            onChange={(e) => setSubcopy(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="mis. Lihat portfolio, pilih layanan, lalu chat WhatsApp."
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">
              Upload foto baru (maks 5 MB)
            </span>
            <input
              key={fileInputKey}
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">
              atau tempel URL foto (HTTPS)
            </span>
            <input
              type="url"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="https://…"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
        {previewUrl ? (
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Pratinjau portrait"
              className="h-24 w-20 rounded-lg bg-neutral-100 object-cover"
            />
            <p className="text-xs text-neutral-500">
              Pratinjau portrait —{" "}
              {file
                ? "file baru yang akan diupload."
                : "foto yang tersimpan sekarang."}
            </p>
          </div>
        ) : (
          <p className="text-xs text-neutral-500">
            Belum ada foto — landing memakai cover portfolio pertama sebagai
            pengganti.
          </p>
        )}
      </div>
      {formError ? (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-amber-700">
          {notice}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-green-700">
          Profil tersimpan — landing ikut terbaru.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving || removing}
          className="rounded-full bg-neutral-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
        >
          {saving ? "Menyimpan…" : "Simpan profil"}
        </button>
        {currentPortrait ? (
          <button
            type="button"
            disabled={saving || removing}
            onClick={onRemovePortrait}
            className="rounded-full border border-red-300 px-6 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
          >
            {removing ? "Menghapus…" : "Hapus foto"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
