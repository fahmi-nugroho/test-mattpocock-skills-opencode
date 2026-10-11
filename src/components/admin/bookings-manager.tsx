"use client";

import { useEffect, useMemo, useState } from "react";
import { validateBookingInput } from "@/lib/admin/validate-booking";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  createBooking,
  deleteBooking,
  listBookingsAdmin,
  setBookingStatus,
  updateBooking,
} from "@/lib/supabase/admin-bookings";
import { listServicesAdmin } from "@/lib/supabase/admin-services";
import { notifyScheduleChanged, SCHEDULE_CHANGED_EVENT } from "@/lib/admin/schedule-events";
import type { Booking, BookingStatus, Service } from "@/lib/supabase/database";
import { getTodayKey } from "@/lib/calendar";

const STATUSES: readonly BookingStatus[] = ["pending", "confirmed", "cancelled"];
const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Menunggu",
  confirmed: "Confirmed",
  cancelled: "Dibatalkan",
};

/**
 * Booking CRUD manager for the admin dashboard (ticket 07). Date +
 * start-end + service + client name/phone + notes, status
 * pending → confirmed / cancelled, reschedule via Ubah (same overlap
 * guard as create). Confirming/cancelling writes the bookings rows the
 * public month RPC derives day-status from, so the public calendar
 * reflects the change on next load without extra wiring. Double
 * bookings are refused by the adapter guard and surfaced as form/row
 * errors in Indonesian.
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
  });
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const serviceName = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of services) map.set(s.id, s.name);
    return (id: string | null) => (id ? (map.get(id) ?? "Layanan dihapus") : "—");
  }, [services]);

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

      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-neutral-200 bg-white p-4"
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
                  Ubah / Reschedule
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
        ))}
      </ul>
      {items.length === 0 && !error ? (
        <p className="mt-3 text-sm text-neutral-600">
          Belum ada booking — catat hasil negosiasi WA pertama di atas.
        </p>
      ) : null}
    </div>
  );
}
