"use client";

import { useEffect, useState } from "react";
import {
  BOOKING_REQUEST_STATUS_LABEL,
  bookingRequestRefusalHint,
  buildFormatBookingLink,
  deriveBookingRequestState,
  requestToBookingDraft,
  type BookingRequestStatus,
} from "@/lib/admin/booking-request";
import { notifyAcceptRequest } from "@/lib/admin/request-events";
import { SCHEDULE_CHANGED_EVENT } from "@/lib/admin/schedule-events";
import { buildFormatBookingWaLink } from "@/lib/whatsapp";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  createBookingRequest,
  listBookingRequestsAdmin,
} from "@/lib/supabase/admin-requests";
import type { BookingRequest } from "@/lib/supabase/database";

const STATUS_STYLE: Record<BookingRequestStatus, string> = {
  open: "bg-neutral-100 text-neutral-700",
  submitted: "bg-amber-100 text-amber-800",
  accepted: "bg-green-100 text-green-800",
  expired: "bg-red-100 text-red-700",
};

interface RequestsManagerProps {
  /** Reports how many submitted requests need attention after each load. */
  onAttentionCountChange?: (count: number) => void;
}

/**
 * "Permintaan" section (booking-request-intake ticket 04): generate a Format
 * Booking link (optional name / WhatsApp number / agreed slot), copy it or
 * open WhatsApp with it prefilled, and list every Booking Request with its
 * derived state. "Jadikan Booking" only appears for a submitted request and
 * hands its fields to the always-mounted booking form through
 * ACCEPT_REQUEST_EVENT — the normal validation + conflict guard still run.
 *
 * No realtime or push: the list refreshes on mount and whenever the shared
 * schedule event fires (e.g. a booking created/deleted elsewhere), so a
 * linked or released request updates its badge without a reload.
 */
export function RequestsManager({
  onAttentionCountChange,
}: RequestsManagerProps) {
  const [items, setItems] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [waNumber, setWaNumber] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    link: string;
    waNumber: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [attentionCount, setAttentionCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const rows = await listBookingRequestsAdmin(supabaseBrowser());
        if (cancelled) return;
        setItems(rows);
        const count = rows.filter(
          (row) => deriveBookingRequestState(row, new Date()) === "submitted",
        ).length;
        setAttentionCount(count);
        onAttentionCountChange?.(count);
        setError(null);
      } catch {
        if (!cancelled) setError("Gagal memuat permintaan. Coba lagi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    // A booking created/deleted elsewhere changes accepted_booking_id (the
    // FK is on delete set null), so refetch to show accepted / released.
    const onChange = () => {
      if (!cancelled) load();
    };
    window.addEventListener(SCHEDULE_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(SCHEDULE_CHANGED_EVENT, onChange);
    };
  }, [onAttentionCountChange]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreateError(null);
    setCopiedLink(null);
    setCreating(true);
    try {
      const row = await createBookingRequest(supabaseBrowser(), {
        client_name: clientName,
        date: date || null,
        start_time: start || null,
        end_time: end || null,
      });
      const link = buildFormatBookingLink(window.location.origin, row.token);
      setCreated({ link, waNumber: waNumber.trim() });
      setItems((prev) => [row, ...prev]);
      setClientName("");
      setWaNumber("");
      setDate("");
      setStart("");
      setEnd("");
      // A brand-new request is open, so the attention count is unchanged.
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Gagal membuat link. Coba lagi.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function onCopy(link: string) {
    setCreateError(null);
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard tidak tersedia");
      }
      await navigator.clipboard.writeText(link);
      setCopiedLink(link);
    } catch {
      setCreateError("Gagal menyalin link — salin manual dari teks di atas.");
    }
  }

  function onAccept(item: BookingRequest) {
    notifyAcceptRequest({
      requestId: item.id,
      draft: requestToBookingDraft(item),
    });
    window.location.hash = "#booking";
  }

  if (loading) {
    return <p className="mt-3 text-sm text-neutral-600">Memuat permintaan…</p>;
  }

  return (
    <div className="mt-4">
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={onCreate}
        className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <h3 className="text-sm font-bold">Buat link Format Booking</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Nama klien (opsional)</span>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nama klien"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">
              No. WhatsApp untuk kirim (opsional)
            </span>
            <input
              type="tel"
              value={waNumber}
              onChange={(e) => setWaNumber(e.target.value)}
              placeholder="08… (tidak disimpan)"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Tanggal (opsional)</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <span className="hidden sm:block" />
          <label className="block">
            <span className="text-sm font-medium">Jam mulai (opsional)</span>
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Jam selesai (opsional)</span>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <p className="text-xs text-neutral-500">
          Tanggal dan jam bersifat opsional dan boleh diisi sebagian saja —
          klien bisa menyesuaikan sendiri. Nomor WhatsApp hanya dipakai untuk
          tombol kirim, tidak disimpan.
        </p>
        {createError ? (
          <p role="alert" className="text-sm text-red-600">
            {createError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={creating}
          className="rounded-full bg-neutral-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
        >
          {creating ? "Membuat…" : "Buat link"}
        </button>
      </form>

      {created ? (
        <div
          role="status"
          className="mt-3 rounded-xl border border-green-200 bg-green-50 p-4"
        >
          <p className="text-sm font-semibold">Link Format Booking siap dikirim</p>
          <p className="mt-1 break-all text-xs text-neutral-700">
            {created.link}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onCopy(created.link)}
              className="rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-xs font-semibold transition hover:bg-neutral-100"
            >
              {copiedLink === created.link ? "Tersalin" : "Salin link"}
            </button>
            {created.waNumber ? (
              <a
                href={buildFormatBookingWaLink(created.waNumber, created.link)}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-700"
              >
                Kirim via WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold">Daftar permintaan</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            attentionCount > 0
              ? "bg-amber-100 text-amber-800"
              : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {attentionCount} perlu ditindak
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {items.map((item) => {
          const status = deriveBookingRequestState(item, new Date());
          return (
            <li
              key={item.id}
              className="rounded-xl border border-neutral-200 bg-white p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}
                >
                  {BOOKING_REQUEST_STATUS_LABEL[status]}
                </span>
                <span className="text-sm font-semibold">
                  {item.client_name || "Tanpa nama"}
                </span>
                <span className="text-xs text-neutral-500">
                  {item.client_phone || "—"}
                </span>
              </div>
              <p className="mt-1 text-xs text-neutral-600">
                {item.event_type || "—"} · {item.headcount} orang ·{" "}
                {item.hairdo || "—"} · {item.venue || "—"}
              </p>
              <p className="mt-0.5 text-xs text-neutral-600">
                Diminta:{" "}
                {item.date
                  ? `${item.date} · ${item.start_time ?? "—"}–${item.end_time ?? "—"}`
                  : "belum ditentukan"}
              </p>
              {item.notes ? (
                <p className="mt-1 text-xs text-neutral-600">{item.notes}</p>
              ) : null}
              <div className="mt-3">
                {status === "submitted" ? (
                  <button
                    type="button"
                    onClick={() => onAccept(item)}
                    className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-700"
                  >
                    Jadikan Booking
                  </button>
                ) : (
                  <div>
                    <button
                      type="button"
                      disabled
                      className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold opacity-50"
                    >
                      Jadikan Booking
                    </button>
                    <p className="mt-1 text-xs text-neutral-500">
                      {bookingRequestRefusalHint(status)}
                    </p>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {items.length === 0 && !error ? (
        <p className="mt-3 text-sm text-neutral-600">
          Belum ada permintaan — buat link pertama di atas.
        </p>
      ) : null}
    </div>
  );
}
