"use client";

import { useEffect, useState } from "react";
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
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [headline, setHeadline] = useState("");
  const [subcopy, setSubcopy] = useState("");
  const [currentPortrait, setCurrentPortrait] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [saving, setSaving] = useState(false);
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
  }, [loadAttempt]);

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

  const previewUrl = objectUrl ?? (manualUrl.trim() || null);
  const portraitRemoved = Boolean(currentPortrait && !manualUrl.trim() && !file);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving || loadError) return;
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

  function stagePortraitRemoval() {
    setSaved(false);
    setFormError(null);
    setManualUrl("");
    setFile(null);
    setFileInputKey((key) => key + 1);
  }

  if (loading) {
    return <p className="mt-3 text-sm text-neutral-600">Memuat profil…</p>;
  }

  if (loadError) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <p role="alert" className="text-sm text-red-700">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoadError(null);
            setLoading(true);
            setLoadAttempt((attempt) => attempt + 1);
          }}
          className="min-h-10 rounded-full border border-neutral-300 bg-white px-4 text-sm font-semibold hover:bg-neutral-100"
        >
          Muat ulang
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSave}
      onChange={() => {
        setSaved(false);
        setFormError(null);
      }}
      className="mt-4 space-y-3 rounded-xl border border-neutral-200 bg-white p-4"
    >
      <h3 className="text-base font-bold">Edit profil</h3>
      <fieldset disabled={saving} className="grid min-w-0 gap-4 disabled:opacity-70">
        <legend className="sr-only">Detail profil</legend>
        <label className="block">
          <span className="text-sm font-medium">
            Judul profil (maks 120 karakter)
          </span>
          <input
            type="text"
            required
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={120}
            placeholder="mis. Tampil memukau di hari spesialmu"
            className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">
            Deskripsi profil (maks 300 karakter)
          </span>
          <textarea
            required
            value={subcopy}
            onChange={(e) => setSubcopy(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="mis. Lihat portfolio, pilih layanan, lalu chat WhatsApp."
            className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
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
              disabled={file !== null}
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="https://…"
              className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
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
              {file || manualUrl.trim() !== currentPortrait
                ? "foto ini akan dipakai saat profil disimpan."
                : "foto yang tersimpan sekarang."}
            </p>
          </div>
        ) : (
          <p role="status" className="text-sm text-neutral-600">
            {portraitRemoved
              ? "Foto akan dihapus saat profil disimpan. Halaman publik akan memakai cover portfolio."
              : "Tanpa foto profil, halaman publik memakai cover portfolio pertama."}
          </p>
        )}
        {currentPortrait ? (
          <div>
            <button
              type="button"
              onClick={portraitRemoved ? () => setManualUrl(currentPortrait) : stagePortraitRemoval}
              className="min-h-10 rounded-full border border-neutral-300 px-4 text-sm font-semibold hover:bg-neutral-100"
            >
              {portraitRemoved ? "Urungkan hapus foto" : "Hapus foto dari draf"}
            </button>
          </div>
        ) : null}
      </fieldset>
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
      <div className="flex justify-end border-t border-neutral-200 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
        >
          {saving ? "Menyimpan…" : "Simpan profil"}
        </button>
      </div>
    </form>
  );
}
