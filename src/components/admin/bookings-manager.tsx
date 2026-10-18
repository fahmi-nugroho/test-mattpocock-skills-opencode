"use client";

import { useEffect, useMemo, useState } from "react";
import { filterByQuery } from "@/lib/admin/filter-items";
import { validateBookingInput } from "@/lib/admin/validate-booking";
import {
  remainingBalance,
  suggestTotal,
} from "@/lib/admin/booking-request";
import {
  ACCEPT_REQUEST_EVENT,
  type AcceptRequestDetail,
} from "@/lib/admin/request-events";
import { formatIDR } from "@/lib/format";
import { isStyle, STYLE_COPY, STYLE_VALUES } from "@/lib/style-reference";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  createBooking,
  deleteBooking,
  listBookingsAdmin,
  setBookingStatus,
  updateBooking,
} from "@/lib/supabase/admin-bookings";
import { linkBookingRequest } from "@/lib/supabase/admin-requests";
import { listServicesAdmin } from "@/lib/supabase/admin-services";
import { notifyScheduleChanged, SCHEDULE_CHANGED_EVENT } from "@/lib/admin/schedule-events";
import { StyleReferenceFacts } from "./style-reference-facts";
import type { Booking, BookingStatus, Service } from "@/lib/supabase/database";
import { getTodayKey } from "@/lib/calendar";

const STATUSES: readonly BookingStatus[] = ["pending", "confirmed", "cancelled"];
const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Menunggu",
  confirmed: "Terkonfirmasi",
  cancelled: "Dibatalkan",
};

/**
 * Parse a numeric form field: "" → fallback (a blank total stays null, a
 * blank headcount/DP keeps its default), otherwise the number.
 */
function parseIntField(value: string, fallback: number): number;
function parseIntField(value: string, fallback: null): number | null;
function parseIntField(value: string, fallback: number | null): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return fallback;
  return Number(trimmed);
}

/**
 * Booking CRUD manager for the admin dashboard (ticket 07, extended ticket
 * 04, and booking-request-style-and-reference ticket 04). Date + start-end +
 * service + client name/phone + notes and the ticket 04 logistics/money fields
 * (event, headcount, venue, hairdo, reference, total, DP), status pending →
 * confirmed / cancelled, reschedule via Ubah (same overlap guard as create).
 * The Style is an optional two-value radio and the Reference an optional text
 * input, in both the create form and the inline row edit; a legacy row keeps
 * its stored text read-only in the list and starts an edit with no Style
 * chosen. Confirming/cancelling writes the bookings rows the
 * public month RPC derives day-status from, so the public calendar reflects
 * the change on next load without extra wiring. Double bookings are refused
 * by the adapter guard and surfaced as form/row errors in Indonesian.
 *
 * "Jadikan Booking" from the Permintaan section dispatches
 * ACCEPT_REQUEST_EVENT; this form listens, prefills, and after a normal
 * (guarded) save links the request to the new booking — the accept path
 * never bypasses validation or the conflict guard.
 */
export function BookingsManager() {
  const [items, setItems] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(() => getTodayKey());
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [serviceId, setServiceId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<BookingStatus>("pending");
  const [eventType, setEventType] = useState("");
  const [headcount, setHeadcount] = useState("1");
  const [venue, setVenue] = useState("");
  const [hairdo, setHairdo] = useState("");
  const [reference, setReference] = useState("");
  // A request accepted from before the change carries free text in the reused
  // column; the radio cannot show it, so it is kept here and shown read-only.
  const [legacyPrefillHairdo, setLegacyPrefillHairdo] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [dpAmount, setDpAmount] = useState("0");
  // Until the admin edits the total by hand, a chosen service keeps it in
  // sync with price × headcount (a hint only — never saved unless left in).
  const [totalTouched, setTotalTouched] = useState(false);
  // Set when "Jadikan Booking" prefilled this form from a request; the next
  // successful save links the request to the new booking.
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState({
    date: "",
    start_time: "",
    end_time: "",
    service_id: "",
    client_name: "",
    client_phone: "",
    notes: "",
    status: "pending" as BookingStatus,
    event_type: "",
    headcount: "1",
    venue: "",
    hairdo: "",
    reference: "",
    total_price: "",
    dp_amount: "0",
  });
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const serviceName = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of services) map.set(s.id, s.name);
    return (id: string | null) => (id ? (map.get(id) ?? "Layanan dihapus") : "—");
  }, [services]);

  // Client-side search over visible text fields only; CRUD/data flow
  // below is unchanged.
  const visibleItems = useMemo(
    () =>
      filterByQuery(items, query, (item) => [
        item.date,
        item.client_name,
        item.client_phone,
        serviceName(item.service_id),
        item.notes,
        STATUS_LABEL[item.status],
      ]),
    [items, query, serviceName],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = supabaseBrowser();
        const [bookings, serviceRows] = await Promise.all([
          listBookingsAdmin(supabase),
          listServicesAdmin(supabase),
        ]);
        if (!cancelled) {
          setItems(bookings);
          setServices(serviceRows);
        }
      } catch {
        if (!cancelled) setError("Gagal memuat booking. Coba lagi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    // Another panel (calendar / blocks) mutated the schedule: refetch
    // so this list never visibly lags a confirm/cancel elsewhere.
    const onChange = () => {
      if (!cancelled) load();
    };
    window.addEventListener(SCHEDULE_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(SCHEDULE_CHANGED_EVENT, onChange);
    };
  }, []);

  // "Jadikan Booking" hand-off: the Permintaan section dispatches the request
  // draft, this always-mounted form fills itself in (client/event fields
  // always; slot only when the admin already set one, else keep the form
  // defaults) and remembers the request to link after a normal save.
  useEffect(() => {
    const onAccept = (event: Event) => {
      const detail = (event as CustomEvent<AcceptRequestDetail>).detail;
      if (!detail) return;
      const { requestId, draft } = detail;
      setClientName(draft.client_name);
      setClientPhone(draft.client_phone);
      setEventType(draft.event_type);
      setHeadcount(String(draft.headcount));
      setVenue(draft.venue);
      // A legacy request's text is not one of the two Styles, so it cannot
      // seed the radio; keep it read-only and leave the radio unselected.
      setHairdo(isStyle(draft.hairdo) ? draft.hairdo : "");
      setLegacyPrefillHairdo(
        draft.hairdo !== "" && !isStyle(draft.hairdo) ? draft.hairdo : "",
      );
      setReference(draft.reference);
      if (draft.date) setDate(draft.date);
      if (draft.start_time) setStart(draft.start_time);
      if (draft.end_time) setEnd(draft.end_time);
      setPendingRequestId(requestId);
      setTotalTouched(false);
      setFormError(null);
    };
    window.addEventListener(ACCEPT_REQUEST_EVENT, onAccept);
    return () => window.removeEventListener(ACCEPT_REQUEST_EVENT, onAccept);
  }, []);

  // Service suggestion: price × headcount fills the total only while the
  // admin has not edited the total by hand; a cleared total stays cleared.
  useEffect(() => {
    if (totalTouched) return;
    const service = services.find((s) => s.id === serviceId);
    if (!service) {
      setTotalPrice("");
      return;
    }
    const suggested = suggestTotal(service.price_idr, parseIntField(headcount, 1));
    setTotalPrice(suggested === null ? "" : String(suggested));
  }, [serviceId, headcount, totalTouched, services]);

  const createRemaining = remainingBalance(
    parseIntField(totalPrice, null),
    parseIntField(dpAmount, 0),
  );

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
    let validated;
    try {
      validated = validateBookingInput({
        date,
        start_time: start,
        end_time: end,
        service_id: serviceId || null,
        client_name: clientName,
        client_phone: clientPhone,
        notes,
        status,
        event_type: eventType,
        headcount: parseIntField(headcount, 1),
        venue,
        hairdo,
        reference,
        total_price: parseIntField(totalPrice, null),
        dp_amount: parseIntField(dpAmount, 0),
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Input tidak valid");
      return;
    }
    setSaving(true);
    try {
      const row = await createBooking(supabaseBrowser(), validated);
      setItems((prev) =>
        [...prev, row].sort((a, b) =>
          a.date === b.date
            ? a.start_time.localeCompare(b.start_time)
            : a.date.localeCompare(b.date),
        ),
      );
      setClientName("");
      setClientPhone("");
      setNotes("");
      setServiceId("");
      setStatus("pending");
      setEventType("");
      setHeadcount("1");
      setVenue("");
      setHairdo("");
      setReference("");
      setLegacyPrefillHairdo("");
      setTotalPrice("");
      setDpAmount("0");
      setTotalTouched(false);
      // A prefilled accept path links the request to the booking it just
      // created. The booking already exists, so a link failure is reported
      // rather than retried — it must never be created a second time. The
      // pending id is cleared no matter what, so a later manual save can
      // never link this request to an unrelated booking.
      if (pendingRequestId) {
        try {
          await linkBookingRequest(supabaseBrowser(), pendingRequestId, row.id);
        } catch (linkErr) {
          setFormError(
            linkErr instanceof Error
              ? linkErr.message
              : "Booking tersimpan, tetapi permintaan gagal ditautkan.",
          );
        } finally {
          setPendingRequestId(null);
        }
      }
      notifyScheduleChanged();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Gagal menyimpan booking. Coba lagi.",
      );
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: Booking) {
    setEditingId(item.id);
    setRowError(null);
    setEditFields({
      date: item.date,
      start_time: item.start_time,
      end_time: item.end_time,
      service_id: item.service_id ?? "",
      client_name: item.client_name,
      client_phone: item.client_phone,
      notes: item.notes,
      status: item.status,
      event_type: item.event_type,
      headcount: String(item.headcount),
      venue: item.venue,
      // Legacy free text in the reused column cannot be re-selected by a
      // two-option radio: it shows read-only in the list, and editing starts
      // with no Style chosen so the admin picks one or leaves it empty.
      hairdo: isStyle(item.hairdo) ? item.hairdo : "",
      reference: item.reference,
      total_price: item.total_price === null ? "" : String(item.total_price),
      dp_amount: String(item.dp_amount),
    });
  }

  async function onSaveEdit(item: Booking) {
    if (rowBusy) return;
    setRowError(null);
    let validated;
    try {
      validated = validateBookingInput({
        date: editFields.date,
        start_time: editFields.start_time,
        end_time: editFields.end_time,
        service_id: editFields.service_id || null,
        client_name: editFields.client_name,
        client_phone: editFields.client_phone,
        notes: editFields.notes,
        status: editFields.status,
        event_type: editFields.event_type,
        headcount: parseIntField(editFields.headcount, 1),
        venue: editFields.venue,
        hairdo: editFields.hairdo,
        reference: editFields.reference,
        total_price: parseIntField(editFields.total_price, null),
        dp_amount: parseIntField(editFields.dp_amount, 0),
      });
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Input tidak valid");
      return;
    }
    setRowBusy(item.id);
    try {
      const row = await updateBooking(supabaseBrowser(), item.id, validated);
      setItems((prev) =>
        prev
          .map((p) => (p.id === item.id ? row : p))
          .sort((a, b) =>
            a.date === b.date
              ? a.start_time.localeCompare(b.start_time)
              : a.date.localeCompare(b.date),
          ),
      );
      setEditingId(null);
      notifyScheduleChanged();
    } catch (err) {
      setRowError(
        err instanceof Error ? err.message : "Gagal menyimpan perubahan. Coba lagi.",
      );
    } finally {
      setRowBusy(null);
    }
  }

  async function onSetStatus(item: Booking, next: BookingStatus) {
    if (rowBusy) return;
    setRowError(null);
    setRowBusy(item.id);
    try {
      const row = await setBookingStatus(supabaseBrowser(), item.id, next);
      setItems((prev) => prev.map((p) => (p.id === item.id ? row : p)));
      notifyScheduleChanged();
    } catch (err) {
      setRowError(
        err instanceof Error ? err.message : "Gagal mengubah status. Coba lagi.",
      );
    } finally {
      setRowBusy(null);
    }
  }

  async function onDelete(item: Booking) {
    if (confirmDeleteId !== item.id) {
      setConfirmDeleteId(item.id);
      return;
    }
    if (rowBusy) return;
    setRowError(null);
    setRowBusy(item.id);
    try {
      await deleteBooking(supabaseBrowser(), item.id);
      setItems((prev) => prev.filter((p) => p.id !== item.id));
      notifyScheduleChanged();
      setConfirmDeleteId(null);
      if (editingId === item.id) setEditingId(null);
    } catch {
      setRowError("Gagal menghapus booking. Coba lagi.");
    } finally {
      setRowBusy(null);
    }
  }

  if (loading) {
    return <p className="mt-3 text-sm text-neutral-600">Memuat booking…</p>;
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

      <form
        onSubmit={onCreate}
        className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <h3 className="text-sm font-bold">Tambah booking</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Tanggal</span>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Layanan</span>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">Tanpa layanan</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Jam mulai</span>
            <input
              type="time"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Jam selesai</span>
            <input
              type="time"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Nama klien</span>
            <input
              type="text"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nama klien"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">No. HP / WA klien</span>
            <input
              type="tel"
              required
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="08…"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Jenis acara</span>
            <input
              type="text"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              placeholder="Wisuda, lamaran…"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Jumlah orang</span>
            <input
              type="number"
              min={1}
              value={headcount}
              onChange={(e) => setHeadcount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Lokasi</span>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Gedung / alamat"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <fieldset className="block sm:col-span-2">
            <legend className="text-sm font-medium">
              Gaya rambut{" "}
              <span className="font-normal text-neutral-500">(opsional)</span>
            </legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {STYLE_VALUES.map((value) => {
                const option = STYLE_COPY[value];
                const selected = hairdo === value;
                return (
                  <label
                    key={value}
                    htmlFor={`create-style-${value}`}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${
                      selected
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-neutral-300 bg-white"
                    }`}
                  >
                    <input
                      id={`create-style-${value}`}
                      type="radio"
                      name="create-hairdo"
                      value={value}
                      checked={selected}
                      onChange={() => {
                        setHairdo(value);
                        setLegacyPrefillHairdo("");
                      }}
                      className="h-4 w-4 accent-neutral-900"
                    />
                    <span className="text-sm font-medium">{option.label}</span>
                  </label>
                );
              })}
            </div>
            {legacyPrefillHairdo ? (
              <p className="mt-1 text-xs text-neutral-500">
                Teks gaya lama (hanya baca): {legacyPrefillHairdo}
              </p>
            ) : null}
          </fieldset>
          <label className="block">
            <span className="text-sm font-medium">
              Referensi{" "}
              <span className="font-normal text-neutral-500">(opsional)</span>
            </span>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Link foto atau deskripsi singkat"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Total harga (Rp)</span>
            <input
              type="number"
              min={0}
              value={totalPrice}
              onChange={(e) => {
                setTotalPrice(e.target.value);
                setTotalTouched(true);
              }}
              placeholder="Kosongkan bila belum disepakati"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">DP (Rp)</span>
            <input
              type="number"
              min={0}
              value={dpAmount}
              onChange={(e) => setDpAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Catatan</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Hasil negosiasi WA, permintaan khusus…"
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as BookingStatus)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {createRemaining !== null ? (
          <p className="text-sm text-neutral-600">
            Sisa pembayaran: {formatIDR(createRemaining)}
          </p>
        ) : null}
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
          {saving ? "Menyimpan…" : "Tambah booking"}
        </button>
      </form>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari booking…"
        aria-label="Cari booking"
        className="mt-4 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
      />
      <ul className="mt-4 space-y-2">
        {visibleItems.map((item) => {
          const legacyHairdo =
            item.hairdo !== "" && !isStyle(item.hairdo) ? item.hairdo : "";
          return (
            <li
              key={item.id}
              className="rounded-xl border border-neutral-200 bg-white p-3"
            >
              {editingId === item.id ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="date"
                    aria-label="Tanggal"
                    value={editFields.date}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, date: e.target.value }))
                    }
                    className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                  <select
                    aria-label="Status"
                    value={editFields.status}
                    onChange={(e) =>
                      setEditFields((f) => ({
                        ...f,
                        status: e.target.value as BookingStatus,
                      }))
                    }
                    className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    aria-label="Jam mulai"
                    value={editFields.start_time}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, start_time: e.target.value }))
                    }
                    className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="time"
                    aria-label="Jam selesai"
                    value={editFields.end_time}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, end_time: e.target.value }))
                    }
                    className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="text"
                    aria-label="Nama klien"
                    value={editFields.client_name}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, client_name: e.target.value }))
                    }
                    className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="tel"
                    aria-label="No. HP klien"
                    value={editFields.client_phone}
                    onChange={(e) =>
                      setEditFields((f) => ({
                        ...f,
                        client_phone: e.target.value,
                      }))
                    }
                    className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="text"
                    aria-label="Jenis acara"
                    value={editFields.event_type}
                    onChange={(e) =>
                      setEditFields((f) => ({
                        ...f,
                        event_type: e.target.value,
                      }))
                    }
                    className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    min={1}
                    aria-label="Jumlah orang"
                    value={editFields.headcount}
                    onChange={(e) =>
                      setEditFields((f) => ({
                        ...f,
                        headcount: e.target.value,
                      }))
                    }
                    className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="text"
                    aria-label="Lokasi"
                    value={editFields.venue}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, venue: e.target.value }))
                    }
                    className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                  <fieldset className="rounded-lg border border-neutral-200 p-2 sm:col-span-2">
                    <legend className="px-1 text-xs font-medium text-neutral-600">
                      Gaya rambut (opsional)
                    </legend>
                    <div className="flex flex-wrap gap-3">
                      {STYLE_VALUES.map((value) => (
                        <label
                          key={value}
                          htmlFor={`edit-style-${item.id}-${value}`}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <input
                            id={`edit-style-${item.id}-${value}`}
                            type="radio"
                            name={`edit-hairdo-${item.id}`}
                            value={value}
                            checked={editFields.hairdo === value}
                            onChange={() =>
                              setEditFields((f) => ({ ...f, hairdo: value }))
                            }
                            className="h-4 w-4 accent-neutral-900"
                          />
                          {STYLE_COPY[value].label}
                        </label>
                      ))}
                    </div>
                    {legacyHairdo ? (
                      <p className="mt-1 text-xs text-neutral-500">
                        Teks lama (hanya baca): {legacyHairdo}
                      </p>
                    ) : null}
                  </fieldset>
                  <input
                    type="text"
                    aria-label="Referensi"
                    placeholder="Referensi (opsional)"
                    value={editFields.reference}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, reference: e.target.value }))
                    }
                    className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm sm:col-span-2"
                  />
                  <input
                    type="number"
                    min={0}
                    aria-label="Total harga"
                    value={editFields.total_price}
                    onChange={(e) =>
                      setEditFields((f) => ({
                        ...f,
                        total_price: e.target.value,
                      }))
                    }
                    className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    aria-label="DP"
                    value={editFields.dp_amount}
                    onChange={(e) =>
                      setEditFields((f) => ({
                        ...f,
                        dp_amount: e.target.value,
                      }))
                    }
                    className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="text"
                    aria-label="Catatan"
                    value={editFields.notes}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, notes: e.target.value }))
                    }
                    className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm sm:col-span-2"
                  />
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold">
                    {item.date} · {item.start_time}–{item.end_time} ·{" "}
                    {STATUS_LABEL[item.status]}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {item.client_name} · {item.client_phone} ·{" "}
                    {serviceName(item.service_id)}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {item.event_type || "—"} · {item.headcount} orang ·{" "}
                    {item.venue || "—"}
                  </p>
                  <StyleReferenceFacts
                    hairdo={item.hairdo}
                    reference={item.reference}
                  />
                  {item.total_price !== null ? (
                    <p className="mt-0.5 text-xs text-neutral-600">
                      Total {formatIDR(item.total_price)} · DP{" "}
                      {formatIDR(item.dp_amount)} · Sisa{" "}
                      {formatIDR(remainingBalance(item.total_price, item.dp_amount) ?? 0)}
                    </p>
                  ) : null}
                  {item.notes ? (
                    <p className="mt-1 text-xs text-neutral-600">{item.notes}</p>
                  ) : null}
                </div>
              )}
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
                    Ubah Jadwal
                  </button>
                )}
                {item.status !== "confirmed" ? (
                  <button
                    type="button"
                    disabled={rowBusy === item.id}
                    onClick={() => onSetStatus(item, "confirmed")}
                    className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold disabled:opacity-60"
                  >
                    Konfirmasi
                  </button>
                ) : null}
                {item.status !== "cancelled" ? (
                  <button
                    type="button"
                    disabled={rowBusy === item.id}
                    onClick={() => onSetStatus(item, "cancelled")}
                    className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold disabled:opacity-60"
                  >
                    Batalkan
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
          );
        })}
      </ul>
      {items.length === 0 && !error ? (
        <p className="mt-3 text-sm text-neutral-600">
          Belum ada booking — catat hasil negosiasi WA pertama di atas.
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
