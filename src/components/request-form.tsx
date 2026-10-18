"use client";

import { useEffect, useMemo, useState } from "react";
import {
  readBookingRequest,
  submitBookingRequest,
  validateBookingRequestPayload,
} from "@/lib/booking-request";
import {
  EMPTY_REQUEST_FORM,
  evaluateClash,
  formFieldsFromContext,
  type BookingRequestFormFields,
} from "@/lib/booking-request-form";
import { getDaySchedule, type DaySchedule } from "@/lib/day-schedule";
import type { RpcClient } from "@/lib/month-availability";
import { supabaseBrowser } from "@/lib/supabase/client";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900";

// Shown next to the slot in every non-blank state: a submitted request never
// reserves the day, so the client must not read the form as a confirmed slot.
const NOT_LOCKED_COPY = "Slot belum terkunci sampai DP diterima.";

/**
 * The page is a small state machine over the token read:
 * - loading: the read is in flight.
 * - ready: the link is open — show the form.
 * - submitted: already sent (from the read) or just sent (from a submit).
 * - expired: the link is past its seven days; no submit action.
 * - error: missing token or a failed read; offers a retry.
 */
type View =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "submitted"; justSubmitted: boolean }
  | { kind: "expired" }
  | { kind: "error"; message: string };

/**
 * Public client Format Booking form. Fetches its context on mount (creating the
 * Supabase client inside the effect so prerender never touches env vars), warns
 * about clashes against the public day schedule without ever blocking a
 * submit, and renders every terminal state in Indonesian.
 */
export function RequestForm({ token }: { token: string }) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [fields, setFields] = useState<BookingRequestFormFields>(
    EMPTY_REQUEST_FORM,
  );
  const [schedule, setSchedule] = useState<DaySchedule | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Bumping this re-runs the read; used by the error state's "Coba lagi".
  const [attempt, setAttempt] = useState(0);

  // Read the link's context. `cancelled` drops a stale response after the
  // token or the retry attempt changes.
  useEffect(() => {
    let cancelled = false;
    setView({ kind: "loading" });
    setFormError(null);
    readBookingRequest(supabaseBrowser() as unknown as RpcClient, token).then(
      (context) => {
        if (cancelled) return;
        switch (context.state) {
          case "open":
            setFields(formFieldsFromContext(context));
            setView({ kind: "ready" });
            break;
          case "submitted":
            setView({ kind: "submitted", justSubmitted: false });
            break;
          case "expired":
            setView({ kind: "expired" });
            break;
          default:
            setView({
              kind: "error",
              message:
                "Link permintaan tidak ditemukan. Pastikan linknya benar, lalu coba lagi.",
            });
        }
      },
      () => {
        if (cancelled) return;
        setView({
          kind: "error",
          message:
            "Gagal memuat formulir. Periksa koneksi lalu coba lagi.",
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  // Fetch the public day schedule whenever the chosen date changes, so the
  // clash warning can be evaluated. A failed read degrades to "no warning"
  // rather than an error — the slot is a warning, never a gate. The guard
  // drops stale responses on a fast date change.
  useEffect(() => {
    if (view.kind !== "ready" || !DATE_RE.test(fields.date)) {
      setSchedule(null);
      return;
    }
    let cancelled = false;
    getDaySchedule(
      supabaseBrowser() as unknown as RpcClient,
      fields.date,
    ).then(
      (row) => {
        if (!cancelled) setSchedule(row);
      },
      () => {
        if (!cancelled) setSchedule(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [view.kind, fields.date]);

  const clash = useMemo(
    () => evaluateClash(fields.date, fields.start_time, fields.end_time, schedule),
    [fields.date, fields.start_time, fields.end_time, schedule],
  );

  function update<K extends keyof BookingRequestFormFields>(
    key: K,
    value: string,
  ): void {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setFormError(null);
    // Validate first so a bad field shows its own Indonesian message naming
    // it, and nothing is submitted. The wrapper re-enforces the same rules.
    try {
      validateBookingRequestPayload(fields);
    } catch (validationError) {
      setFormError(
        validationError instanceof Error
          ? validationError.message
          : "Data permintaan tidak valid.",
      );
      return;
    }

    setSaving(true);
    try {
      const outcome = await submitBookingRequest(
        supabaseBrowser() as unknown as RpcClient,
        token,
        fields,
      );
      if (outcome.ok) {
        setView({ kind: "submitted", justSubmitted: true });
        return;
      }
      switch (outcome.reason) {
        case "already_submitted":
          setView({ kind: "submitted", justSubmitted: false });
          return;
        case "expired":
        case "not_found":
          setView({ kind: "expired" });
          return;
        default:
          setFormError("Data permintaan tidak valid. Periksa lagi isianmu.");
      }
    } catch {
      setFormError(
        "Gagal mengirim permintaan. Periksa koneksi lalu coba lagi.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (view.kind === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="mt-6 rounded-xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-600"
      >
        Memuat formulir…
      </div>
    );
  }

  if (view.kind === "submitted") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-6 rounded-xl border border-stone-200 bg-white p-6 text-center"
      >
        <h2 className="font-display text-lg font-bold">
          {view.justSubmitted
            ? "Permintaan terkirim"
            : "Permintaan sudah dikirim"}
        </h2>
        <p className="mt-2 text-sm text-stone-700">
          {view.justSubmitted
            ? "Terima kasih! Permintaanmu sudah kami terima. Kami akan menghubungi kamu lewat WhatsApp."
            : "Permintaan ini sudah pernah dikirim, jadi tidak perlu diisi ulang."}
        </p>
        <p className="mt-3 rounded-lg bg-gold-soft px-3 py-2 text-xs text-gold-deep">
          {NOT_LOCKED_COPY}
        </p>
      </div>
    );
  }

  if (view.kind === "expired") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-6 rounded-xl border border-stone-200 bg-white p-6 text-center"
      >
        <h2 className="font-display text-lg font-bold">Link kedaluwarsa</h2>
        <p className="mt-2 text-sm text-stone-700">
          Link ini sudah kedaluwarsa. Minta link baru ke Makeup Artist lewat
          WhatsApp untuk mengisi formulir lagi.
        </p>
      </div>
    );
  }

  if (view.kind === "error") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-6 rounded-xl border border-stone-200 bg-white p-6 text-center"
      >
        <p className="text-sm text-stone-700">{view.message}</p>
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className="mt-3 rounded-full bg-stone-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-stone-700"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <p className="text-sm text-stone-600">
        Isi data di bawah ini supaya Makeup Artist bisa menyiapkan jadwalmu.
      </p>

      <label htmlFor="req-name" className="block">
        <span className="text-sm font-medium">Nama</span>
        <input
          id="req-name"
          type="text"
          autoComplete="name"
          value={fields.client_name}
          onChange={(event) => update("client_name", event.target.value)}
          className={INPUT_CLASS}
        />
      </label>

      <label htmlFor="req-phone" className="block">
        <span className="text-sm font-medium">Nomor WhatsApp</span>
        <input
          id="req-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={fields.client_phone}
          onChange={(event) => update("client_phone", event.target.value)}
          className={INPUT_CLASS}
        />
      </label>

      <label htmlFor="req-event" className="block">
        <span className="text-sm font-medium">Jenis acara</span>
        <input
          id="req-event"
          type="text"
          value={fields.event_type}
          onChange={(event) => update("event_type", event.target.value)}
          className={INPUT_CLASS}
        />
      </label>

      <label htmlFor="req-headcount" className="block">
        <span className="text-sm font-medium">Jumlah orang</span>
        <input
          id="req-headcount"
          type="number"
          min={1}
          inputMode="numeric"
          value={fields.headcount}
          onChange={(event) => update("headcount", event.target.value)}
          className={INPUT_CLASS}
        />
      </label>

      <label htmlFor="req-venue" className="block">
        <span className="text-sm font-medium">Lokasi / Venue</span>
        <input
          id="req-venue"
          type="text"
          value={fields.venue}
          onChange={(event) => update("venue", event.target.value)}
          className={INPUT_CLASS}
        />
      </label>

      <label htmlFor="req-hairdo" className="block">
        <span className="text-sm font-medium">Model rambut / Hairdo</span>
        <input
          id="req-hairdo"
          type="text"
          value={fields.hairdo}
          onChange={(event) => update("hairdo", event.target.value)}
          className={INPUT_CLASS}
        />
      </label>

      <label htmlFor="req-notes" className="block">
        <span className="text-sm font-medium">Catatan</span>
        <textarea
          id="req-notes"
          rows={3}
          value={fields.notes}
          onChange={(event) => update("notes", event.target.value)}
          className={INPUT_CLASS}
        />
      </label>

      <label htmlFor="req-date" className="block">
        <span className="text-sm font-medium">Tanggal</span>
        <input
          id="req-date"
          type="date"
          value={fields.date}
          onChange={(event) => update("date", event.target.value)}
          className={INPUT_CLASS}
        />
      </label>

      <label htmlFor="req-start" className="block">
        <span className="text-sm font-medium">Jam mulai</span>
        <input
          id="req-start"
          type="time"
          value={fields.start_time}
          onChange={(event) => update("start_time", event.target.value)}
          className={INPUT_CLASS}
        />
      </label>

      <label htmlFor="req-end" className="block">
        <span className="text-sm font-medium">Jam selesai</span>
        <input
          id="req-end"
          type="time"
          value={fields.end_time}
          onChange={(event) => update("end_time", event.target.value)}
          className={INPUT_CLASS}
        />
      </label>

      {clash === "order" ? (
        <p role="alert" className="text-sm font-medium text-red-700">
          Jam selesai harus setelah jam mulai.
        </p>
      ) : clash === "blocked" ? (
        <p
          role="status"
          className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900"
        >
          Tanggal ini ditutup penuh. Kamu tetap bisa mengirim permintaan, tetapi
          tanggal atau jam lain kemungkinan lebih baik.
        </p>
      ) : clash === "overlap" ? (
        <p
          role="status"
          className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900"
        >
          Jam yang dipilih bentrok dengan jadwal yang sudah terisi. Kamu tetap
          bisa mengirim permintaan.
        </p>
      ) : null}

      <p className="rounded-lg bg-gold-soft px-3 py-2 text-xs text-gold-deep">
        {NOT_LOCKED_COPY}
      </p>

      {formError ? (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-full bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:opacity-60"
      >
        {saving ? "Mengirim…" : "Kirim permintaan"}
      </button>
    </form>
  );
}
