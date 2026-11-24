"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RequestSlotValidationError, type RequestSlotInput } from "@/lib/admin/validate-booking-request";
import {
  BookingRequestFieldError,
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
import { getPublicWaNumber } from "@/lib/supabase/public-settings";
import { BUSINESS_NAME } from "@/lib/brand";
import { STYLE_COPY, STYLE_VALUES } from "@/lib/style-reference";
import { buildWaLink } from "@/lib/whatsapp";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const INPUT_CLASS =
  "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 aria-invalid:border-red-700";

type RequestField = keyof BookingRequestFormFields;

// Shown next to the slot in every non-blank state: a submitted request never
// reserves the day, so the client must not read the form as a confirmed slot.
const NOT_LOCKED_COPY = "Slot belum terkunci sampai DP diterima.";

// Photos are never uploaded here; the client sends them in the WhatsApp thread
// they are already in, so this line stops them hunting for an upload button.
const PHOTOS_VIA_WHATSAPP_COPY =
  "Tidak ada unggah foto di formulir ini. Kirim foto referensimu lewat WhatsApp.";

/**
 * The page is a small state machine over the token read:
 * - loading: the read is in flight.
 * - ready: the link is open — show the form.
 * - submitted: already sent (from the read) or just sent (from a submit).
 * - expired or missing: request a fresh link from the artist.
 * - error: a failed read; offers a retry.
 */
type View =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "submitted"; justSubmitted: boolean }
  | { kind: "expired" }
  | { kind: "missing" }
  | { kind: "error"; message: string };

/**
 * Public client Format Booking form. Fetches its context on mount (creating the
 * Supabase client inside the effect so prerender never touches env vars), warns
 * about clashes against the public day schedule without ever blocking a
 * submit, and renders every terminal state in Indonesian.
 */
export function RequestForm({ token }: { token: string }) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [waNumber, setWaNumber] = useState<string | undefined>(process.env.NEXT_PUBLIC_WA_NUMBER);
  const needsWhatsApp = view.kind === "submitted" || view.kind === "expired" || view.kind === "missing";
  const [fields, setFields] = useState<BookingRequestFormFields>(
    EMPTY_REQUEST_FORM,
  );
  const [schedule, setSchedule] = useState<DaySchedule | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<BookingRequestFieldError | RequestSlotValidationError | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  // Bumping this re-runs the read; used by the error state's "Coba lagi".
  const [attempt, setAttempt] = useState(0);

  // Read the link's context. `cancelled` drops a stale response after the
  // token or the retry attempt changes.
  useEffect(() => {
    let cancelled = false;
    setView({ kind: "loading" });
    setFormError(null);
    setFieldError(null);
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
          case "missing":
            setView({ kind: "missing" });
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

  useEffect(() => {
    if (!needsWhatsApp) return;
    let cancelled = false;
    getPublicWaNumber(supabaseBrowser()).then(
      (number) => {
        if (!cancelled) setWaNumber(number);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [needsWhatsApp]);

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
    () => evaluateClash(fields.date, fields.start_time, fields.end_time,
      schedule?.date === fields.date ? schedule : null),
    [fields.date, fields.start_time, fields.end_time, schedule],
  );

  useEffect(() => {
    if (!fieldError) return;
    formRef.current?.querySelector<HTMLElement>(`[name="${fieldError.field}"]`)?.focus();
  }, [fieldError]);

  function update(key: RequestField, value: string): void {
    setFields((current) => ({ ...current, [key]: value }));
    if (fieldError?.field === key || (key === "start_time" && fieldError?.field === "end_time")) {
      setFieldError(null);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (saving) return;
    setFormError(null);
    setFieldError(null);
    try {
      const incompleteSlot = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>(
        'input[type="date"], input[type="time"]',
      )).find((input) => input.validity.badInput);
      if (incompleteSlot) {
        throw new RequestSlotValidationError(
          incompleteSlot.name as keyof RequestSlotInput,
          "Lengkapi isian ini atau kosongkan jika belum ditentukan.",
        );
      }
      validateBookingRequestPayload(fields);
    } catch (validationError) {
      if (validationError instanceof BookingRequestFieldError || validationError instanceof RequestSlotValidationError) {
        setFieldError(validationError);
      } else {
        setFormError("Data permintaan tidak valid. Periksa lagi isianmu.");
      }
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
          setView({ kind: "expired" });
          return;
        case "not_found":
          setView({ kind: "missing" });
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

  function fieldMessage(field: RequestField) {
    if (fieldError?.field === field) return fieldError.message;
    if (field === "end_time" && fields.start_time && fields.end_time && fields.end_time <= fields.start_time) {
      return "Jam selesai harus setelah jam mulai.";
    }
  }

  function fieldProps(field: RequestField, hint?: string) {
    const invalid = Boolean(fieldMessage(field));
    return {
      name: field,
      "aria-invalid": invalid || undefined,
      "aria-describedby": [hint, invalid && `req-error-${field}`].filter(Boolean).join(" ") || undefined,
    };
  }

  function renderFieldError(field: RequestField) {
    const message = fieldMessage(field);
    return message ? <p id={`req-error-${field}`} role="alert" className="mt-1 text-sm text-red-700">{message}</p> : null;
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

  if (view.kind === "submitted" || view.kind === "expired" || view.kind === "missing") {
    const submitted = view.kind === "submitted";
    const title = submitted
      ? (view.justSubmitted ? "Permintaan terkirim" : "Permintaan sudah dikirim")
      : (view.kind === "expired" ? "Link kedaluwarsa" : "Link tidak ditemukan");
    const number = waNumber?.replace(/\D/g, "");
    const href = number && /^\d{8,15}$/.test(number) && number !== "6280000000000"
      ? buildWaLink(number, submitted
        ? "Halo, saya mau menindaklanjuti permintaan makeup yang sudah saya kirim."
        : "Halo, boleh minta link Format Booking yang baru?")
      : undefined;
    return (
      <div className="mt-6 rounded-xl border border-stone-200 bg-white p-6 text-center">
        <div role="status">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-700">
            {submitted
              ? "Penata rias akan memeriksa permintaanmu dan menghubungi kamu lewat WhatsApp untuk mengonfirmasi jadwal."
              : `Minta link baru di chat WhatsApp dengan ${BUSINESS_NAME} untuk mengisi formulir.`}
          </p>
          {submitted ? (
            <p className="mt-3 rounded-lg bg-gold-soft px-3 py-2 text-sm text-gold-deep">
              {NOT_LOCKED_COPY}
            </p>
          ) : null}
        </div>
        {href ? (
          <a
            href={href}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-espresso px-5 py-2 text-sm font-semibold text-white hover:bg-stone-700"
          >
            {submitted ? "Kembali ke WhatsApp" : "Minta link baru lewat WhatsApp"}
          </a>
        ) : null}
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
          className="mt-3 min-h-11 rounded-full bg-espresso px-5 py-2 text-sm font-semibold text-white hover:bg-stone-700"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate aria-busy={saving} className="mt-6 space-y-5">
      <fieldset disabled={saving} className="min-w-0 rounded-xl border border-stone-200 bg-white p-4">
        <legend className="px-1 text-base font-semibold">
          Jadwal yang diminta <span className="text-sm font-normal text-stone-600">(opsional)</span>
        </legend>
        <p id="req-schedule-hint" className="text-sm leading-relaxed text-stone-700">
          Penata rias akan mengonfirmasi jadwal lewat WhatsApp. {NOT_LOCKED_COPY}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="col-span-2 min-w-0">
            <label htmlFor="req-date" className="text-sm font-medium">Tanggal</label>
            <input
              {...fieldProps("date", "req-schedule-hint")}
              id="req-date"
              type="date"
              value={fields.date}
              onChange={(event) => update("date", event.target.value)}
              className={INPUT_CLASS}
            />
            {renderFieldError("date")}
          </div>
          <div className="min-w-0">
            <label htmlFor="req-start" className="text-sm font-medium">Jam mulai</label>
            <input
              {...fieldProps("start_time")}
              id="req-start"
              type="time"
              value={fields.start_time}
              onChange={(event) => update("start_time", event.target.value)}
              className={INPUT_CLASS}
            />
            {renderFieldError("start_time")}
          </div>
          <div className="min-w-0">
            <label htmlFor="req-end" className="text-sm font-medium">Jam selesai</label>
            <input
              {...fieldProps("end_time")}
              id="req-end"
              type="time"
              value={fields.end_time}
              onChange={(event) => update("end_time", event.target.value)}
              className={INPUT_CLASS}
            />
            {renderFieldError("end_time")}
          </div>
        </div>
        {clash === "blocked" || clash === "overlap" ? (
          <p role="status" className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-sm leading-relaxed text-amber-900">
            {clash === "blocked"
              ? "Tanggal ini ditutup. Pilih tanggal lain jika bisa."
              : "Jam ini bentrok dengan jadwal lain. Pilih jam lain jika bisa."}{" "}
            Kamu tetap bisa mengirim permintaan.
          </p>
        ) : null}
      </fieldset>

      <fieldset disabled={saving} className="min-w-0 space-y-3 border-t border-stone-200 pt-3">
        <legend className="pr-2 text-base font-semibold">Kontak</legend>
        <div>
          <label htmlFor="req-name" className="text-sm font-medium">Nama (wajib)</label>
          <input
            {...fieldProps("client_name")}
            id="req-name"
            type="text"
            required
            autoComplete="name"
            value={fields.client_name}
            onChange={(event) => update("client_name", event.target.value)}
            className={INPUT_CLASS}
          />
          {renderFieldError("client_name")}
        </div>
        <div>
          <label htmlFor="req-phone" className="text-sm font-medium">Nomor WhatsApp (wajib)</label>
          <input
            {...fieldProps("client_phone")}
            id="req-phone"
            type="tel"
            required
            inputMode="tel"
            autoComplete="tel"
            value={fields.client_phone}
            onChange={(event) => update("client_phone", event.target.value)}
            className={INPUT_CLASS}
          />
          {renderFieldError("client_phone")}
        </div>
      </fieldset>

      <fieldset disabled={saving} className="min-w-0 space-y-3 border-t border-stone-200 pt-3">
        <legend className="pr-2 text-base font-semibold">Detail acara</legend>
        <div>
          <label htmlFor="req-event" className="text-sm font-medium">Jenis acara (opsional)</label>
          <input
            {...fieldProps("event_type")}
            id="req-event"
            type="text"
            value={fields.event_type}
            onChange={(event) => update("event_type", event.target.value)}
            className={INPUT_CLASS}
          />
          {renderFieldError("event_type")}
        </div>
        <div>
          <label htmlFor="req-headcount" className="text-sm font-medium">Jumlah orang (wajib)</label>
          <input
            {...fieldProps("headcount")}
            id="req-headcount"
            type="number"
            required
            min={1}
            max={100}
            inputMode="numeric"
            value={fields.headcount}
            onChange={(event) => update("headcount", event.target.value)}
            className={INPUT_CLASS}
          />
          {renderFieldError("headcount")}
        </div>
        <div>
          <label htmlFor="req-venue" className="text-sm font-medium">Lokasi acara (opsional)</label>
          <input
            {...fieldProps("venue")}
            id="req-venue"
            type="text"
            value={fields.venue}
            onChange={(event) => update("venue", event.target.value)}
            className={INPUT_CLASS}
          />
          {renderFieldError("venue")}
        </div>
        <fieldset className="min-w-0">
          <legend className="text-sm font-medium">Gaya rambut (wajib)</legend>
          <div className="mt-2 space-y-2">
            {STYLE_VALUES.map((value) => {
              const option = STYLE_COPY[value];
              const selected = fields.hairdo === value;
              return (
                <label
                  key={value}
                  className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${selected
                    ? "border-stone-900 bg-stone-50"
                    : "border-stone-300 bg-white"
                  }`}
                >
                  <input
                    {...fieldProps("hairdo")}
                    id={`req-style-${value}`}
                    type="radio"
                    required
                    value={value}
                    checked={selected}
                    onChange={(event) => update("hairdo", event.target.value)}
                    className="mt-0.5 size-4 accent-stone-900"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-stone-900">{option.label}</span>
                    <span className="block text-sm text-stone-600">{option.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {renderFieldError("hairdo")}
        </fieldset>
        <div>
          <label htmlFor="req-reference" className="text-sm font-medium">Referensi (opsional)</label>
          <p id="req-reference-hint" className="text-sm leading-relaxed text-stone-700">
            Tempel link foto atau deskripsikan tampilan yang kamu mau. {PHOTOS_VIA_WHATSAPP_COPY}
          </p>
          <input
            {...fieldProps("reference", "req-reference-hint")}
            id="req-reference"
            type="text"
            value={fields.reference}
            onChange={(event) => update("reference", event.target.value)}
            className={INPUT_CLASS}
          />
          {renderFieldError("reference")}
        </div>
        <div>
          <label htmlFor="req-notes" className="text-sm font-medium">Catatan (opsional)</label>
          <textarea
            {...fieldProps("notes")}
            id="req-notes"
            rows={3}
            value={fields.notes}
            onChange={(event) => update("notes", event.target.value)}
            className={INPUT_CLASS}
          />
          {renderFieldError("notes")}
        </div>
      </fieldset>

      {formError ? <p role="alert" className="text-sm text-red-700">{formError}</p> : null}
      <button
        type="submit"
        disabled={saving}
        className="min-h-11 w-full rounded-full bg-espresso px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:opacity-60"
      >
        {saving ? "Mengirim…" : "Kirim permintaan"}
      </button>
    </form>
  );
}
