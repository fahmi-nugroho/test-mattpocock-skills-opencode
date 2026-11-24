"use client";

import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { ConfirmAction } from "@/components/admin/confirm-action";
import {
  BOOKING_FILTERS,
  BOOKING_FILTER_LABEL,
  BOOKING_STATUSES,
  BOOKING_STATUS_LABEL,
  filterBookings,
  type BookingFilter,
} from "@/lib/admin/booking-filter";
import { filterByQuery } from "@/lib/admin/filter-items";
import {
  indexInvoicesByBooking,
  invoiceBusiness,
  invoiceSentLabel,
  paymentPosition,
} from "@/lib/admin/invoice";
import {
  LIST_PAGE_SIZE,
  splitByToday,
  windowRows,
} from "@/lib/admin/list-window";
import { summarizeBookings } from "@/lib/admin/overview";
import { servicePriceTotal, validateBookingInput } from "@/lib/admin/validate-booking";
import { remainingBalance } from "@/lib/admin/booking-request";
import {
  ACCEPT_REQUEST_EVENT,
  type AcceptRequestDetail,
} from "@/lib/admin/request-events";
import { formatIDR } from "@/lib/format";
import { isStyle, STYLE_COPY, STYLE_VALUES } from "@/lib/style-reference";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  enqueueMirrorWork,
  listMirrorSnapshot,
} from "@/lib/supabase/admin-mirror";
import {
  indexMirrorStates,
  MIRROR_STATE_LABEL,
} from "@/lib/google/mirror-state";
import {
  createBooking,
  deleteBooking,
  getBookingById,
  listBookingsAdmin,
  recordPelunasan,
  setBookingStatus,
  undoPelunasan,
  updateBooking,
  type BookingPatch,
} from "@/lib/supabase/admin-bookings";
import { listInvoicesAdmin } from "@/lib/supabase/admin-invoices";
import { linkBookingRequest } from "@/lib/supabase/admin-requests";
import { getSettings } from "@/lib/supabase/admin-settings";
import { listServicesAdmin } from "@/lib/supabase/admin-services";
import { notifyScheduleChanged, SCHEDULE_CHANGED_EVENT } from "@/lib/admin/schedule-events";
import { SERVICE_CATALOG_CHANGED_EVENT } from "@/lib/admin/service-catalog-events";
import { Dialog } from "@/components/dialog";
import { InvoiceDialog } from "./invoice-dialog";
import { StyleReferenceFacts } from "./style-reference-facts";
import type {
  Booking,
  BookingService,
  BookingStatus,
  GoogleCalendarEventRow,
  GoogleCalendarWorkRow,
  Invoice,
  Service,
  Settings,
} from "@/lib/supabase/database";
import { getTodayKey } from "@/lib/calendar";

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

function BagianMuaField({ total, ...input }: { total: string } &
  Pick<ComponentProps<"input">, "name" | "value" | "defaultValue" | "onChange">) {
  return (
    <label className="block">
      <span className="text-sm font-medium">Bagian MUA (Rp)</span>
      <input
        type="number"
        min={0}
        max={parseIntField(total, null) ?? undefined}
        step={1}
        placeholder="Kosongkan bila belum diketahui"
        className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        {...input}
      />
    </label>
  );
}

interface ServiceDraft {
  id: string;
  name: string;
  pricing?: { unit_price: string; quantity: string };
}

function blankBookingDraft() {
  return {
    date: "",
    start: "",
    end: "",
    selectedServices: [] as ServiceDraft[],
    clientName: "",
    clientPhone: "",
    notes: "",
    status: "pending" as BookingStatus,
    eventType: "",
    headcount: "1",
    venue: "",
    hairdo: "",
    reference: "",
    legacyPrefillHairdo: "",
    manualTotal: "",
    dpAmount: "0",
    bagianMua: "",
  };
}

type BookingCreateDraft = ReturnType<typeof blankBookingDraft>;

function serviceDraft({ id, name, pricing }: BookingService): ServiceDraft {
  return {
    id,
    name,
    pricing: pricing && {
      unit_price: String(pricing.unit_price),
      quantity: String(pricing.quantity),
    },
  };
}

function serviceSelections(items: readonly ServiceDraft[]) {
  return items.map(({ id, pricing }) => ({
    id,
    pricing: pricing && {
      unit_price: parseIntField(pricing.unit_price, NaN),
      quantity: parseIntField(pricing.quantity, NaN),
    },
  }));
}

function bookingEditFields(item: Booking) {
  return {
    date: item.date,
    start_time: item.start_time,
    end_time: item.end_time,
    selected_services: item.selected_services.map(serviceDraft),
    client_name: item.client_name,
    client_phone: item.client_phone,
    notes: item.notes,
    status: item.status,
    event_type: item.event_type,
    headcount: String(item.headcount),
    venue: item.venue,
    hairdo: isStyle(item.hairdo) ? item.hairdo : "",
    reference: item.reference,
    total_price: String(item.total_price ?? ""),
    dp_amount: String(item.dp_amount),
    bagian_mua: String(item.bagian_mua ?? ""),
  };
}

function BookingServicesPicker({
  selected,
  catalog,
  headcount,
  saved = [],
  onChange,
}: {
  selected: ServiceDraft[];
  catalog: Service[];
  headcount: string;
  saved?: BookingService[];
  onChange: (services: ServiceDraft[]) => void;
}) {
  const picker = useRef<HTMLSelectElement>(null);
  const group = useRef<HTMLFieldSetElement>(null);
  const available = catalog.filter(({ id }) => !selected.some((service) => service.id === id));
  const count = parseIntField(headcount, 1);
  const firstQuantity = Number.isInteger(count) && count > 0 ? headcount || "1" : "1";

  function itemize(services: ServiceDraft[]) {
    return services.map((service, index) => service.pricing ? service : {
      ...service,
      pricing: { unit_price: "", quantity: index === 0 ? firstQuantity : "1" },
    });
  }

  function changePricing(id: string, pricing: NonNullable<ServiceDraft["pricing"]>) {
    onChange(selected.map((service) => service.id === id ? { ...service, pricing } : service));
  }

  return (
    <fieldset ref={group} tabIndex={-1} className="min-w-0 sm:col-span-2">
      <legend className="text-sm font-medium">
        Layanan <span className="font-normal text-neutral-500">(opsional)</span>
      </legend>
      <select
        ref={picker}
        aria-label="Tambah layanan"
        value=""
        disabled={available.length === 0}
        onChange={(e) => {
          const service = available.find(({ id }) => id === e.target.value);
          if (!service) return;
          const previous = saved.find(({ id }) => id === service.id);
          const newService = serviceDraft({
            id: service.id,
            name: previous?.name ?? service.name,
            pricing: previous?.pricing ?? {
              unit_price: service.price_idr,
              quantity: selected.length === 0 ? Number(firstQuantity) : 1,
            },
          });
          onChange([...itemize(selected), newService]);
        }}
        className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-50"
      >
        <option value="">
          {available.length ? "Tambah layanan" : "Tidak ada layanan untuk ditambahkan"}
        </option>
        {available.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
      </select>
      {selected.length > 0 ? (
        <ul className="mt-2 divide-y divide-neutral-200">
          {selected.map(({ id, name, pricing }) => (
            <li key={id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-2 text-sm">
              <span className="break-words font-medium">{name}</span>
              <button
                type="button"
                aria-label={`Hapus layanan ${name}`}
                onClick={() => {
                  onChange(selected.filter((service) => service.id !== id));
                  requestAnimationFrame(() => {
                    const target = picker.current?.disabled ? group.current : picker.current;
                    target?.focus({ preventScroll: true });
                  });
                }}
                className="min-h-11 shrink-0 rounded-lg border border-neutral-300 px-3 text-xs font-semibold hover:bg-neutral-100"
              >
                Hapus
              </button>
              {pricing && (
                <div className="col-span-2 grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
                  <label className="min-w-0">
                    <span className="text-xs font-medium">Harga satuan (Rp)</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      required
                      aria-label={`Harga satuan (Rp) ${name}`}
                      value={pricing.unit_price}
                      onChange={(e) => changePricing(id, { ...pricing, unit_price: e.target.value })}
                      className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 text-base sm:text-sm"
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="text-xs font-medium">Jumlah</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      required
                      aria-label={`Jumlah ${name}`}
                      value={pricing.quantity}
                      onChange={(e) => changePricing(id, { ...pricing, quantity: e.target.value })}
                      className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 text-base sm:text-sm"
                    />
                  </label>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {selected.length > 0 && selected.every(({ pricing }) => !pricing) && (
        <button
          type="button"
          onClick={() => {
            onChange(itemize(selected));
            requestAnimationFrame(() => group.current?.querySelector<HTMLInputElement>('input[type="number"]')?.focus());
          }}
          className="min-h-11 rounded-lg border border-neutral-300 px-3 text-sm font-semibold hover:bg-neutral-100"
        >
          Rinci harga layanan
        </button>
      )}
    </fieldset>
  );
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
 *
 * The list itself lives in a dialog (form-layout-polish ticket 03): the
 * section keeps the create form and shows a summary plus a trigger, and the
 * dialog splits the rows it already loaded into Mendatang and Riwayat, ten at
 * a time. Opening it fetches nothing. Status chips (invoice-and-booking-filter
 * ticket 06) narrow those rows before the search, so a Booking must match
 * both; the split and its paging then run on the filtered set while the
 * trigger's counts stay computed from every Booking.
 */
export function BookingsManager() {
  const [items, setItems] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualDraft, setManualDraft] = useState(() => ({
    ...blankBookingDraft(), date: getTodayKey(), start: "09:00", end: "10:00",
  }));
  const [requestDraft, setRequestDraft] = useState<{
    requestId: string;
    customerNotes: string;
    values: BookingCreateDraft;
  } | null>(null);
  const [unlinkedBookings, setUnlinkedBookings] = useState<Partial<Record<string, string>>>({});
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const savedBookingId = requestDraft ? unlinkedBookings[requestDraft.requestId] : undefined;
  const {
    date, start, end, selectedServices, clientName, clientPhone, notes, status,
    eventType, headcount, venue, hairdo, reference, legacyPrefillHairdo,
    manualTotal, dpAmount, bagianMua,
  } = requestDraft?.values ?? manualDraft;

  function updateDraft(changes: Partial<BookingCreateDraft>) {
    if (requestDraft) {
      setRequestDraft((current) => current && {
        ...current, values: { ...current.values, ...changes },
      });
    } else {
      setManualDraft((current) => ({ ...current, ...changes }));
    }
  }
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editFields, setEditFields] = useState({
    date: "",
    start_time: "",
    end_time: "",
    selected_services: [] as ServiceDraft[],
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
    bagian_mua: "",
  });
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const editingId = editingBooking?.id ?? null;
  const savedServices = editingBooking?.selected_services ?? [];
  // A row op's failure, kept with the row it belongs to so the reason appears
  // in that row even when the dialog shows twenty of them.
  const [rowError, setRowError] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const [query, setQuery] = useState("");
  // The chosen status chip; `all` shows every Booking.
  const [filter, setFilter] = useState<BookingFilter>("all");
  // The list lives in a dialog (form-layout-polish ticket 03); the section
  // keeps the create form and shows a summary plus this trigger.
  const [listOpen, setListOpen] = useState(false);
  // How many rows each group has revealed; reset on every chip or search
  // change so a narrowed list always opens at one page.
  const [revealedUpcoming, setRevealedUpcoming] = useState(LIST_PAGE_SIZE);
  const [revealedHistory, setRevealedHistory] = useState(LIST_PAGE_SIZE);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const filterRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // Invoices are loaded with the bookings so a row can show its count and
  // newest number without opening anything. The dialog reads the same rows.
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  // Business name and payment details for the Invoice picture. A failed read
  // still prints the business name and em dashes, so it never blocks bookings.
  const [settings, setSettings] = useState<Settings | null>(null);
  const [businessLoadFailed, setBusinessLoadFailed] = useState(false);
  const [invoiceBookingId, setInvoiceBookingId] = useState<string | null>(null);
  // Calendar Mirror rows: derived state per Booking, never hand-set. A failed
  // read leaves both empty so bookings still load when Google bookkeeping is
  // unavailable.
  const [mirrorTracked, setMirrorTracked] = useState<GoogleCalendarEventRow[]>(
    [],
  );
  const [mirrorWork, setMirrorWork] = useState<GoogleCalendarWorkRow[]>([]);
  // The row action is the invoice dialog's trigger: after the dialog closes
  // and the booking list reopens, focus returns to it.
  const invoiceButtonRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const pendingInvoiceFocusRef = useRef<string | null>(null);

  // One newest-first group per Booking: the row summary and the dialog list
  // read the same order, and neither reads the live Booking.
  const invoicesByBooking = useMemo(
    () => indexInvoicesByBooking(invoices),
    [invoices],
  );
  // Tersinkron / Menunggu / Gagal come from the tracked row and the open queue
  // row, so the badge cannot drift from what Google actually knows.
  const mirrorStates = useMemo(
    () => indexMirrorStates(items, mirrorTracked, mirrorWork),
    [items, mirrorTracked, mirrorWork],
  );
  const invoiceBooking = invoiceBookingId
    ? (items.find((item) => item.id === invoiceBookingId) ?? null)
    : null;
  const invoiceBookingInvoices = invoiceBookingId
    ? (invoicesByBooking.get(invoiceBookingId) ?? [])
    : [];
  // One stable object for the preview: the picture redraws when settings load
  // or change, not on every render of the booking list.
  const invoiceBusinessDetails = useMemo(
    () => invoiceBusiness(settings),
    [settings],
  );

  // The chosen chip runs first through the pure `filterBookings`, then the
  // client-side search narrows that subset, so a Booking must match both.
  const visibleItems = useMemo(
    () =>
      filterByQuery(
        filterBookings(items, filter),
        query,
        (item) => [
          item.date,
          item.client_name,
          item.client_phone,
          ...item.selected_services.map(({ name }) => name),
          item.notes,
          BOOKING_STATUS_LABEL[item.status],
        ],
      ),
    [items, filter, query],
  );

  // The dialog reads the rows the section already loaded — opening it fetches
  // nothing. Today's key is pinned per render so the split and the trigger's
  // counts agree with each other.
  const todayKey = getTodayKey();
  const { upcoming, history } = useMemo(
    () => splitByToday(visibleItems, todayKey),
    [visibleItems, todayKey],
  );
  const upcomingWindow = windowRows(upcoming, revealedUpcoming);
  const historyWindow = windowRows(history, revealedHistory);

  /** Both groups open at one page whenever the chip or search changes. */
  function resetReveals() {
    setRevealedUpcoming(LIST_PAGE_SIZE);
    setRevealedHistory(LIST_PAGE_SIZE);
  }

  /** Changing the chip opens both groups at one page again. */
  function changeFilter(next: BookingFilter) {
    setFilter(next);
    resetReveals();
  }

  /** Changing the search text opens both groups at one page again. */
  function changeQuery(next: string) {
    setQuery(next);
    resetReveals();
  }

  // Roving tabindex for the chip tablist: arrow keys move the selection (and
  // therefore the single tab stop) between chips, Home/End jump to the ends.
  function onFilterKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const last = BOOKING_FILTERS.length - 1;
    const current = BOOKING_FILTERS.indexOf(filter);
    let next: number | null = null;
    if (e.key === "ArrowRight") next = current === last ? 0 : current + 1;
    else if (e.key === "ArrowLeft") next = current === 0 ? last : current - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    changeFilter(BOOKING_FILTERS[next]);
    filterRefs.current[next]?.focus();
  }

  /** Switch from the booking list to this booking's invoices. */
  function openInvoices(item: Booking) {
    setListOpen(false);
    setInvoiceBookingId(item.id);
  }

  /** Close the invoice dialog back onto the booking list, at its row trigger. */
  function closeInvoices() {
    pendingInvoiceFocusRef.current = invoiceBookingId;
    setInvoiceBookingId(null);
    setListOpen(true);
  }

  /** A just-issued Invoice joins the loaded rows; its row summary updates. */
  function onInvoiceCreated(invoice: Invoice) {
    setInvoices((prev) => [
      invoice,
      ...prev.filter((row) => row.id !== invoice.id),
    ]);
  }

  /** A sent mark or date correction replaces the row the dialog and list read. */
  function onInvoiceUpdated(invoice: Invoice) {
    setInvoices((prev) =>
      prev.map((row) => (row.id === invoice.id ? invoice : row)),
    );
  }

  /** A deleted Invoice leaves at once, so the booking row's count follows. */
  function onInvoiceDeleted(invoiceId: string) {
    setInvoices((prev) => prev.filter((row) => row.id !== invoiceId));
  }

  // The trigger's summary reuses the overview summariser the Ringkasan cards
  // already use, so the number on the button cannot drift from the counts.
  const summary = useMemo(
    () => summarizeBookings(items, todayKey),
    [items, todayKey],
  );
  const upcomingCount =
    summary.todayConfirmed +
    summary.todayPending +
    summary.upcomingConfirmed +
    summary.upcomingPending;
  const upcomingWaiting = summary.todayPending + summary.upcomingPending;

  /** Re-read the two mirror tables after a save or a manual retry. */
  async function refreshMirrorRows() {
    try {
      const snapshot = await listMirrorSnapshot(supabaseBrowser());
      setMirrorTracked(snapshot.tracked);
      setMirrorWork(snapshot.work);
    } catch {
      // The Booking list stays usable even if mirror bookkeeping is unreadable.
    }
  }

  /**
   * Ask the Node route to drain. The browser never holds a Google credential;
   * a failure here stays invisible to the Booking save and is reflected by the
   * Gagal badge instead.
   */
  async function requestMirrorDrain() {
    try {
      const { data } = await supabaseBrowser().auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      await fetch("/api/admin/google-calendar", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "drain" }),
      });
    } catch {
      // Left queued for the next drain.
    }
  }

  async function drainAndRefreshMirror() {
    await requestMirrorDrain();
    await refreshMirrorRows();
  }

  /** One-tap retry for a Gagal row: refresh the intent, then drain at once. */
  async function onRetryMirror(item: Booking) {
    if (rowBusy) return;
    setRowBusy(item.id);
    setRowError(null);
    try {
      await enqueueMirrorWork(
        supabaseBrowser(),
        item.id,
        item.status === "confirmed" ? "upsert" : "delete",
      );
      await drainAndRefreshMirror();
    } catch (err) {
      setRowError({
        id: item.id,
        message:
          err instanceof Error
            ? err.message
            : "Gagal mencoba ulang sinkronisasi Google.",
      });
    } finally {
      setRowBusy(null);
    }
  }

  useEffect(() => {
    let latestLoad = 0;
    async function load() {
      const loadId = ++latestLoad;
      try {
        const supabase = supabaseBrowser();
        const [bookings, serviceRows, invoiceRows, businessResult, mirror] =
          await Promise.all([
            listBookingsAdmin(supabase),
            listServicesAdmin(supabase),
            listInvoicesAdmin(supabase),
            getSettings(supabase).then(
              (row) => ({ row, failed: false }),
              () => ({ row: null, failed: true }),
            ),
            listMirrorSnapshot(supabase).catch(() => ({
              tracked: [] as GoogleCalendarEventRow[],
              work: [] as GoogleCalendarWorkRow[],
            })),
          ]);
        if (loadId === latestLoad) {
          setItems(bookings);
          setServices(serviceRows);
          setInvoices(invoiceRows);
          setSettings(businessResult.row);
          setBusinessLoadFailed(businessResult.failed);
          setMirrorTracked(mirror.tracked);
          setMirrorWork(mirror.work);
        }
      } catch {
        if (loadId === latestLoad) setError("Gagal memuat booking. Coba lagi.");
      } finally {
        if (loadId === latestLoad) setLoading(false);
      }
    }
    void load();
    window.addEventListener(SCHEDULE_CHANGED_EVENT, load);
    window.addEventListener(SERVICE_CATALOG_CHANGED_EVENT, load);
    return () => {
      latestLoad++;
      window.removeEventListener(SCHEDULE_CHANGED_EVENT, load);
      window.removeEventListener(SERVICE_CATALOG_CHANGED_EVENT, load);
    };
  }, []);

  // Closing the invoice dialog reopens the booking list in the same update.
  // The list's own effect has already moved focus into its panel by now, so the
  // dialog's trigger (the row's invoice action) takes focus back afterwards.
  useEffect(() => {
    if (!listOpen) return;
    const bookingId = pendingInvoiceFocusRef.current;
    if (!bookingId) return;
    pendingInvoiceFocusRef.current = null;
    const frame = requestAnimationFrame(() => {
      invoiceButtonRefs.current.get(bookingId)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [listOpen]);

  const activeRequestId = requestDraft?.requestId;
  const draftFieldsetProps = {
    disabled: saving || Boolean(savedBookingId),
    hidden: Boolean(savedBookingId),
  };

  useEffect(() => {
    const onAccept = (event: Event) => {
      const detail = (event as CustomEvent<AcceptRequestDetail>).detail;
      if (!detail || saving) return;
      if (activeRequestId && activeRequestId !== detail.requestId) {
        setFormError("Selesaikan draf permintaan ini atau kembali ke booking manual sebelum membuka permintaan lain.");
      } else {
        const { requestId, draft, customerNotes } = detail;
        setRequestDraft((current) => current ?? {
          requestId,
          customerNotes,
          values: {
            ...blankBookingDraft(),
            clientName: draft.client_name,
            clientPhone: draft.client_phone,
            eventType: draft.event_type,
            headcount: String(draft.headcount),
            venue: draft.venue,
            hairdo: isStyle(draft.hairdo) ? draft.hairdo : "",
            legacyPrefillHairdo: isStyle(draft.hairdo) ? "" : draft.hairdo,
            reference: draft.reference,
            date: draft.date,
            start: draft.start_time,
            end: draft.end_time,
          },
        });
        setFormError(null);
        setSaveNotice(null);
      }
      requestAnimationFrame(() => {
        const form = document.getElementById("booking-form");
        form?.focus({ preventScroll: true });
        form?.scrollIntoView({ block: "start", behavior: "instant" });
      });
    };
    window.addEventListener(ACCEPT_REQUEST_EVENT, onAccept);
    return () => window.removeEventListener(ACCEPT_REQUEST_EVENT, onAccept);
  }, [activeRequestId, saving]);

  const createSelections = serviceSelections(selectedServices);
  const totalPrice = selectedServices.length
    ? String(servicePriceTotal(createSelections) ?? "")
    : manualTotal;
  const editItemized = editFields.selected_services.some(({ pricing }) => pricing !== undefined);
  const editTotal = editItemized
    ? String(servicePriceTotal(serviceSelections(editFields.selected_services)) ?? "")
    : editFields.total_price;

  const createRemaining = remainingBalance(
    parseIntField(totalPrice, null),
    parseIntField(dpAmount, 0),
  );

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
    setSaveNotice(null);
    let bookingId = savedBookingId;
    let created = false;
    let linked = false;
    setSaving(true);
    try {
      const client = supabaseBrowser();
      if (!bookingId) {
        const validated = validateBookingInput({
          date,
          start_time: start,
          end_time: end,
          selected_services: createSelections,
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
          bagian_mua: parseIntField(bagianMua, null),
        });
        const row = await createBooking(client, validated);
        bookingId = row.id;
        created = true;
        setItems((previous) => [...previous, row]);
        if (requestDraft) {
          const { requestId } = requestDraft;
          setUnlinkedBookings((previous) => ({ ...previous, [requestId]: row.id }));
        } else {
          setManualDraft({ ...blankBookingDraft(), date, start, end });
        }
      }
      if (requestDraft) {
        const { requestId } = requestDraft;
        await linkBookingRequest(client, requestId, bookingId);
        linked = true;
        setUnlinkedBookings((previous) => {
          const remaining = { ...previous };
          delete remaining[requestId];
          return remaining;
        });
        setRequestDraft(null);
        setSaveNotice("Booking dari permintaan tersimpan. Kamu bisa melanjutkan draf manual.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Coba lagi.";
      setFormError(bookingId && requestDraft ? `Booking sudah tersimpan. ${message}` : message);
    } finally {
      if (created || linked) notifyScheduleChanged();
      // The Google mirror runs after the app has saved the booking.
      if (created) void drainAndRefreshMirror();
      setSaving(false);
    }
  }

  function startEdit(item: Booking) {
    setEditingBooking(item);
    setRowError(null);
    setEditFields(bookingEditFields(item));
  }

  async function onSaveEdit(item: Booking, totalPrice: string) {
    if (rowBusy || !editingBooking) return;
    setRowError(null);
    let patch: BookingPatch;
    try {
      const { selected_services, ...details } = validateBookingInput({
        date: editFields.date,
        start_time: editFields.start_time,
        end_time: editFields.end_time,
        selected_services: serviceSelections(editFields.selected_services),
        client_name: editFields.client_name,
        client_phone: editFields.client_phone,
        notes: editFields.notes,
        status: editFields.status,
        event_type: editFields.event_type,
        headcount: parseIntField(editFields.headcount, 1),
        venue: editFields.venue,
        hairdo: editFields.hairdo,
        reference: editFields.reference,
        total_price: parseIntField(totalPrice, null),
        dp_amount: parseIntField(editFields.dp_amount, 0),
        bagian_mua: parseIntField(editFields.bagian_mua, null),
      });
      if (editingBooking.pelunasan_amount !== null && details.total_price !== editingBooking.total_price) {
        throw new Error("Total rincian layanan harus sama dengan total saat pelunasan dicatat.");
      }
      const originalFields = bookingEditFields(editingBooking);
      const submittedFields = { ...editFields, total_price: totalPrice };
      patch = Object.fromEntries(Object.entries(details).filter(([key]) => {
        const field = key as keyof typeof details;
        return submittedFields[field] !== (originalFields[field] ?? "");
      }));
      if (selected_services.length !== savedServices.length ||
          selected_services.some(({ id, pricing }, index) => {
            const saved = savedServices[index];
            return id !== saved.id || pricing?.unit_price !== saved.pricing?.unit_price ||
              pricing?.quantity !== saved.pricing?.quantity;
          })) {
        patch.selected_services = selected_services;
      }
    } catch (err) {
      setRowError({
        id: item.id,
        message: err instanceof Error ? err.message : "Input tidak valid",
      });
      return;
    }
    if (Object.keys(patch).length === 0) {
      setEditingBooking(null);
      return;
    }
    setRowBusy(item.id);
    try {
      const row = await updateBooking(supabaseBrowser(), item.id, patch);
      // Same one ordering rule: the split orders the list, not this save.
      setItems((prev) => prev.map((p) => (p.id === item.id ? row : p)));
      setEditingBooking(null);
      notifyScheduleChanged();
      void drainAndRefreshMirror();
    } catch (err) {
      setRowError({
        id: item.id,
        message:
          err instanceof Error
            ? err.message
            : "Gagal menyimpan perubahan. Coba lagi.",
      });
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
      void drainAndRefreshMirror();
    } catch (err) {
      setRowError({
        id: item.id,
        message:
          err instanceof Error ? err.message : "Gagal mengubah status. Coba lagi.",
      });
    } finally {
      setRowBusy(null);
    }
  }

  async function onChangePelunasan(item: Booking, bagianMua: number | null) {
    if (rowBusy) return;
    const undo = item.pelunasan_amount !== null;
    setRowError(null);
    setRowBusy(item.id);
    const failureMessage = undo ? "Gagal membatalkan pelunasan." : "Gagal mencatat pelunasan.";
    try {
      const client = supabaseBrowser();
      const row = undo ? await undoPelunasan(client, item) : await recordPelunasan(client, item, bagianMua);
      setItems((prev) => prev.map((p) => (p.id === item.id ? row : p)));
    } catch (err) {
      const saved = await getBookingById(supabaseBrowser(), item.id).catch(() => null);
      if (saved) {
        setItems((prev) => prev.map((p) => (p.id === item.id ? saved : p)));
      }
      setRowError({
        id: item.id,
        message: err instanceof Error ? err.message : failureMessage,
      });
    } finally {
      setRowBusy(null);
    }
  }

  async function onDelete(item: Booking) {
    if (rowBusy) return;
    setRowError(null);
    setRowBusy(item.id);
    try {
      await deleteBooking(supabaseBrowser(), item.id);
      setItems((prev) => prev.filter((p) => p.id !== item.id));
      setUnlinkedBookings((previous) => Object.fromEntries(
        Object.entries(previous).filter(([, bookingId]) => bookingId !== item.id),
      ));
      // The FK cascades in the database; the loaded list follows at once.
      setInvoices((prev) => prev.filter((row) => row.booking_id !== item.id));
      notifyScheduleChanged();
      // The Booking row is gone; its tracked row survives so the drain can
      // still delete the Google event.
      void drainAndRefreshMirror();
      if (editingId === item.id) setEditingBooking(null);
    } catch {
      setRowError({
        id: item.id,
        message: "Gagal menghapus booking. Coba lagi.",
      });
    } finally {
      setRowBusy(null);
    }
  }

  /** One Booking row, with its inline editor, its actions, and its messages. */
  function renderRow(item: Booking) {
    const legacyHairdo =
      item.hairdo !== "" && !isStyle(item.hairdo) ? item.hairdo : "";
    const bookingInvoices = invoicesByBooking.get(item.id) ?? [];
    const newestInvoice = bookingInvoices[0] ?? null;
    const mirrorState = mirrorStates.get(item.id) ?? null;
    const hasPelunasan = item.pelunasan_amount !== null;
    const payment = item.total_price === null
      ? null
      : paymentPosition(item.total_price, item.dp_amount, item.pelunasan_amount);
    const settlementAmount = item.pelunasan_amount ?? payment?.remaining ?? 0;
    const settlementLabel = hasPelunasan ? "Batalkan Pelunasan" : "Catat Pelunasan";
    const editFormId = `booking-edit-${item.id}`;
    return (
      <li
        key={item.id}
        className="rounded-xl border border-neutral-200 bg-white p-3"
      >
        {editingId === item.id ? (
          <form
            id={editFormId}
            onSubmit={(e) => {
              e.preventDefault();
              void onSaveEdit(item, editTotal);
            }}
            className="grid gap-2 sm:grid-cols-2"
          >
            <label className="block">
              <span className="text-sm font-medium">Tanggal</span>
              <input
                type="date"
                autoFocus
                value={editFields.date}
                onChange={(e) =>
                  setEditFields((f) => ({ ...f, date: e.target.value }))
                }
                className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Status</span>
              <select
                value={editFields.status}
                onChange={(e) =>
                  setEditFields((f) => ({
                    ...f,
                    status: e.target.value as BookingStatus,
                  }))
                }
                className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                {BOOKING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {BOOKING_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Jam mulai</span>
              <input
                type="time"
                value={editFields.start_time}
                onChange={(e) =>
                  setEditFields((f) => ({
                    ...f,
                    start_time: e.target.value,
                  }))
                }
                className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Jam selesai</span>
              <input
                type="time"
                value={editFields.end_time}
                onChange={(e) =>
                  setEditFields((f) => ({ ...f, end_time: e.target.value }))
                }
                className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Nama klien</span>
              <input
                type="text"
                value={editFields.client_name}
                onChange={(e) =>
                  setEditFields((f) => ({
                    ...f,
                    client_name: e.target.value,
                  }))
                }
                className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">No. HP / WA klien</span>
              <input
                type="tel"
                value={editFields.client_phone}
                onChange={(e) =>
                  setEditFields((f) => ({
                    ...f,
                    client_phone: e.target.value,
                  }))
                }
                placeholder="08…"
                className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Jenis acara</span>
              <input
                type="text"
                value={editFields.event_type}
                onChange={(e) =>
                  setEditFields((f) => ({
                    ...f,
                    event_type: e.target.value,
                  }))
                }
                placeholder="Wisuda, lamaran…"
                className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Jumlah orang</span>
              <input
                type="number"
                min={1}
                value={editFields.headcount}
                onChange={(e) =>
                  setEditFields((f) => ({
                    ...f,
                    headcount: e.target.value,
                  }))
                }
                className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <BookingServicesPicker
              selected={editFields.selected_services}
              catalog={services}
              headcount={editFields.headcount}
              saved={savedServices}
              onChange={(selected_services) => setEditFields((fields) => ({ ...fields, selected_services }))}
            />
            <label className="block">
              <span className="text-sm font-medium">Lokasi</span>
              <input
                type="text"
                value={editFields.venue}
                onChange={(e) =>
                  setEditFields((f) => ({ ...f, venue: e.target.value }))
                }
                placeholder="Gedung / alamat"
                className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
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
                      className="h-4 w-4 accent-espresso"
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
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">
                Referensi{" "}
                <span className="font-normal text-neutral-500">
                  (opsional)
                </span>
              </span>
              <input
                type="text"
                value={editFields.reference}
                onChange={(e) =>
                  setEditFields((f) => ({
                    ...f,
                    reference: e.target.value,
                  }))
                }
                placeholder="Link foto atau deskripsi singkat"
                className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">
                Total harga (Rp){editItemized ? " · otomatis" : ""}
              </span>
              <input
                type="number"
                min={0}
                value={editTotal}
                readOnly={hasPelunasan || editItemized}
                required={!editItemized && editFields.selected_services.length > 1}
                onChange={editItemized ? undefined : (e) =>
                  setEditFields((f) => ({
                    ...f,
                    total_price: e.target.value,
                  }))
                }
                placeholder={editItemized ? "Lengkapi rincian layanan" : "Kosongkan bila belum disepakati"}
                className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm read-only:bg-neutral-50"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">DP (Rp)</span>
              <input
                type="number"
                min={0}
                value={editFields.dp_amount}
                readOnly={hasPelunasan}
                onChange={(e) =>
                  setEditFields((f) => ({
                    ...f,
                    dp_amount: e.target.value,
                  }))
                }
                className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <BagianMuaField
              value={editFields.bagian_mua}
              total={editTotal}
              onChange={(e) => setEditFields((fields) => ({ ...fields, bagian_mua: e.target.value }))}
            />
            {hasPelunasan ? (
              <p className="text-xs text-neutral-600 sm:col-span-2">
                {editItemized && item.total_price !== null
                  ? `Total saat pelunasan dicatat: ${formatIDR(item.total_price)}. `
                  : ""}
                Pilih Batalkan Pelunasan untuk mengubah total atau DP.
              </p>
            ) : null}
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">Catatan</span>
              <input
                type="text"
                value={editFields.notes}
                onChange={(e) =>
                  setEditFields((f) => ({ ...f, notes: e.target.value }))
                }
                className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
          </form>
        ) : (
          <div>
            <p className="text-sm font-semibold">
              {item.date} · {item.start_time}–{item.end_time} ·{" "}
              {BOOKING_STATUS_LABEL[item.status]}
              {mirrorState ? (
                <span
                  aria-label={`Status Google Calendar: ${MIRROR_STATE_LABEL[mirrorState]}`}
                  className={`ml-2 inline-block rounded-full px-2 py-0.5 align-middle text-[11px] font-semibold ${
                    mirrorState === "synced"
                      ? "bg-green-100 text-green-800"
                      : mirrorState === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {MIRROR_STATE_LABEL[mirrorState]}
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 break-words text-xs text-neutral-500">
              {item.client_name} · {item.client_phone} ·{" "}
              {item.selected_services.map(({ name }) => name).join(", ") || "—"}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {item.event_type || "—"} · {item.headcount} orang ·{" "}
              {item.venue || "—"}
            </p>
            <StyleReferenceFacts
              hairdo={item.hairdo}
              reference={item.reference}
            />
            {item.total_price !== null && payment ? (
              <p className="mt-0.5 text-xs text-neutral-600">
                Total {formatIDR(item.total_price)} · DP{" "}
                {formatIDR(item.dp_amount)}
                {item.pelunasan_amount !== null
                  ? ` · Pelunasan ${formatIDR(item.pelunasan_amount)}`
                  : ""}
                {" · Sisa "}{formatIDR(Math.max(0, payment.remaining))}
                {" · "}{item.dp_amount > 0 || hasPelunasan ? payment.status : "Belum dibayar"}
              </p>
            ) : null}
            {item.bagian_mua !== null ? (
              <p className="mt-0.5 text-xs text-neutral-600">Bagian MUA {formatIDR(item.bagian_mua)}</p>
            ) : null}
            {item.notes ? (
              <p className="mt-1 text-xs text-neutral-600">{item.notes}</p>
            ) : null}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {editingId !== item.id ? (
            <>
              {settlementAmount > 0 ? (
                <ConfirmAction
                  label={settlementLabel}
                  title={`${settlementLabel} ${item.client_name}?`}
                  description={hasPelunasan
                    ? `Hapus catatan pelunasan sebesar ${formatIDR(settlementAmount)} dari booking ini. Invoice yang sudah terbit tetap tersimpan.`
                    : `Catat sisa pembayaran sebesar ${formatIDR(settlementAmount)} sebagai pelunasan.`}
                  onConfirm={(form) => onChangePelunasan(item, parseIntField(String(form.get("bagian_mua") ?? ""), null))}
                  destructive={hasPelunasan}
                  disabled={rowBusy !== null}
                >
                  {hasPelunasan ? null : (
                    <BagianMuaField
                      name="bagian_mua"
                      total={String(item.total_price ?? "")}
                      defaultValue={String(item.bagian_mua ?? item.total_price ?? "")}
                    />
                  )}
                </ConfirmAction>
              ) : null}
              <button
                ref={(el) => {
                  if (el) invoiceButtonRefs.current.set(item.id, el);
                  else invoiceButtonRefs.current.delete(item.id);
                }}
                type="button"
                onClick={() => openInvoices(item)}
                aria-haspopup="dialog"
                className="min-h-10 rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold transition hover:bg-neutral-100"
              >
                {newestInvoice
                  ? `Invoice (${bookingInvoices.length}) · ${newestInvoice.number} · ${invoiceSentLabel(newestInvoice)}`
                  : "Buat invoice"}
              </button>
              {mirrorState === "failed" ? (
                <button
                  type="button"
                  disabled={rowBusy === item.id}
                  onClick={() => onRetryMirror(item)}
                  className="rounded-full border border-amber-400 px-4 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-50 disabled:opacity-60"
                >
                  {rowBusy === item.id ? "Mencoba…" : "Coba lagi"}
                </button>
              ) : null}
            </>
          ) : null}
          {editingId === item.id ? (
            <>
              <button
                type="submit"
                form={editFormId}
                disabled={rowBusy === item.id}
                className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                {rowBusy === item.id ? "Menyimpan…" : "Simpan"}
              </button>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold"
              >
                Batal
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={rowBusy !== null}
              onClick={() => startEdit(item)}
              className="min-h-10 rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold hover:bg-neutral-100 disabled:opacity-60"
            >
              Ubah Jadwal
            </button>
          )}
          {editingId !== item.id ? (
            <>
              {item.status !== "confirmed" ? (
                <ConfirmAction
                  label="Konfirmasi booking"
                  title={`Konfirmasi booking ${item.client_name}?`}
                  description="Jam booking ini akan tercatat sebagai terisi di kalender publik."
                  onConfirm={() => onSetStatus(item, "confirmed")}
                  disabled={rowBusy !== null}
                />
              ) : null}
              {item.status !== "cancelled" ? (
                <ConfirmAction
                  label="Batalkan booking"
                  title={`Batalkan booking ${item.client_name}?`}
                  description="Booking akan tetap tercatat sebagai batal. Jamnya dapat tersedia kembali di kalender publik."
                  onConfirm={() => onSetStatus(item, "cancelled")}
                  disabled={rowBusy !== null}
                  destructive
                />
              ) : null}
              <ConfirmAction
                label="Hapus booking"
                title={`Hapus booking ${item.client_name}?`}
                description="Booking dan invoice terkait akan dihapus. Jadwal publik akan diperbarui."
                onConfirm={() => onDelete(item)}
                disabled={rowBusy !== null}
                destructive
              />
            </>
          ) : null}
        </div>
        {rowError?.id === item.id ? (
          <p role="alert" className="mt-2 text-xs text-red-600">
            {rowError.message}
          </p>
        ) : null}
      </li>
    );
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

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setListOpen(true)}
        aria-haspopup="dialog"
        className="mb-4 flex w-full flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-gold-soft/55 px-4 py-3 text-left transition hover:bg-gold-soft"
      >
        <span>
          <span className="block text-sm font-semibold">
            Lihat daftar booking
          </span>
          <span className="mt-0.5 block text-xs text-neutral-600">
            {upcomingCount} mendatang · {upcomingWaiting} masih menunggu
          </span>
        </span>
        <span aria-hidden="true" className="ml-auto text-lg">
          ›
        </span>
      </button>

      <form
        id="booking-form"
        onSubmit={onCreate}
        tabIndex={-1}
        className="scroll-mt-24 space-y-5 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5"
      >
        <header className="space-y-2">
          <h3 className="text-sm font-bold">{requestDraft ? "Booking dari permintaan" : "Tambah booking"}</h3>
          {requestDraft ? (
            <div className="space-y-2">
              <p className="text-sm text-neutral-600">
                {savedBookingId
                  ? "Booking sudah tersimpan. Selesaikan penautan ke permintaan."
                  : "Draf manual tetap tersedia selama dashboard ini terbuka."}
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={(event) => {
                  event.currentTarget.form?.focus();
                  setRequestDraft(null);
                  setFormError(null);
                }}
                className="min-h-11 rounded-full border border-neutral-300 px-4 text-sm font-semibold hover:bg-neutral-100 disabled:opacity-60"
              >
                {savedBookingId ? "Kembali ke booking manual" : "Batalkan draf permintaan"}
              </button>
            </div>
          ) : null}
          {saveNotice ? <p role="status" className="text-sm text-green-700">{saveNotice}</p> : null}
        </header>
        {requestDraft ? (
          <dl className="space-y-1 rounded-lg bg-neutral-50 px-4 py-3">
            <dt className="text-sm font-semibold">Catatan dari klien</dt>
            <dd className="whitespace-pre-wrap [overflow-wrap:anywhere] text-sm text-neutral-700">
              {requestDraft.customerNotes || "Klien tidak menambahkan catatan."}
            </dd>
          </dl>
        ) : null}
        <fieldset {...draftFieldsetProps} className="min-w-0 space-y-3 disabled:opacity-70">
          <legend className="text-sm font-semibold">Jadwal</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="text-sm font-medium">Tanggal</span>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => updateDraft({ date: e.target.value })}
                className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Jam mulai</span>
              <input
                type="time"
                required
                value={start}
                onChange={(e) => updateDraft({ start: e.target.value })}
                className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Jam selesai</span>
              <input
                type="time"
                required
                value={end}
                onChange={(e) => updateDraft({ end: e.target.value })}
                className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Status</span>
              <select
                value={status}
                onChange={(e) => updateDraft({ status: e.target.value as BookingStatus })}
                className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                {BOOKING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {BOOKING_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
        <fieldset {...draftFieldsetProps} className="min-w-0 space-y-3 disabled:opacity-70">
          <legend className="text-sm font-semibold">Klien</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="text-sm font-medium">Nama klien</span>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => updateDraft({ clientName: e.target.value })}
                placeholder="Nama klien"
                className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">No. HP / WA klien</span>
              <input
                type="tel"
                required
                value={clientPhone}
                onChange={(e) => updateDraft({ clientPhone: e.target.value })}
                placeholder="08…"
                className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </fieldset>
        <fieldset {...draftFieldsetProps} className="min-w-0 space-y-3 disabled:opacity-70">
          <legend className="text-sm font-semibold">
            Layanan dan detail acara
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Jenis acara</span>
              <input
                type="text"
                value={eventType}
                onChange={(e) => updateDraft({ eventType: e.target.value })}
                placeholder="Wisuda, lamaran…"
                className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Jumlah orang</span>
              <input
                type="number"
                min={1}
                value={headcount}
                onChange={(e) => updateDraft({ headcount: e.target.value })}
                className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <BookingServicesPicker
              selected={selectedServices}
              catalog={services}
              headcount={headcount}
              onChange={(value) => updateDraft({ selectedServices: value })}
            />
            <label className="block">
              <span className="text-sm font-medium">Lokasi</span>
              <input
                type="text"
                value={venue}
                onChange={(e) => updateDraft({ venue: e.target.value })}
                placeholder="Gedung / alamat"
                className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <fieldset className="min-w-0">
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
                      className={`flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 ${
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
                        onChange={() => updateDraft({ hairdo: value, legacyPrefillHairdo: "" })}
                        className="h-4 w-4 accent-espresso"
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
                onChange={(e) => updateDraft({ reference: e.target.value })}
                placeholder="Link foto atau deskripsi singkat"
                className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </fieldset>
        <fieldset {...draftFieldsetProps} className="min-w-0 space-y-3 disabled:opacity-70">
          <legend className="text-sm font-semibold">
            Pembayaran dan catatan
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="text-sm font-medium">
                Total harga (Rp){selectedServices.length ? " · otomatis" : ""}
              </span>
              <input
                type="number"
                min={0}
                value={totalPrice}
                readOnly={selectedServices.length > 0}
                onChange={selectedServices.length ? undefined : (e) => updateDraft({ manualTotal: e.target.value })}
                placeholder={selectedServices.length ? "Lengkapi rincian layanan" : "Kosongkan bila belum disepakati"}
                className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm read-only:bg-neutral-50"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">DP (Rp)</span>
              <input
                type="number"
                min={0}
                value={dpAmount}
                onChange={(e) => updateDraft({ dpAmount: e.target.value })}
                className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <BagianMuaField value={bagianMua} total={totalPrice} onChange={(e) => updateDraft({ bagianMua: e.target.value })} />
            {createRemaining !== null ? (
              <p className="text-sm text-neutral-600 sm:col-span-2">
                Sisa pembayaran: {formatIDR(createRemaining)}
              </p>
            ) : null}
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">Catatan internal</span>
              <input
                type="text"
                value={notes}
                onChange={(e) => updateDraft({ notes: e.target.value })}
                placeholder="Hasil negosiasi WA, permintaan khusus…"
                className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </fieldset>
        {formError ? (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        ) : null}
        <div className="flex justify-end border-t border-neutral-200 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="min-h-11 rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60"
          >
            {saving ? "Memproses…" : savedBookingId ? "Tautkan booking" : "Tambah booking"}
          </button>
        </div>
      </form>

      <Dialog
        open={listOpen}
        onClose={() => setListOpen(false)}
        title="Daftar booking"
        returnFocusTo={triggerRef}
      >
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Filter status booking"
          onKeyDown={onFilterKeyDown}
        >
          {BOOKING_FILTERS.map((value, index) => {
            const selected = value === filter;
            return (
              <button
                key={value}
                ref={(el) => {
                  filterRefs.current[index] = el;
                }}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => changeFilter(value)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  selected
                    ? "bg-stone-900 text-amber-50"
                    : "bg-stone-200/60 text-stone-700 hover:bg-stone-200"
                }`}
              >
                {BOOKING_FILTER_LABEL[value]}
              </button>
            );
          })}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => changeQuery(e.target.value)}
          placeholder="Cari booking…"
          aria-label="Cari booking"
          className="mt-4 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
        />
        {items.length === 0 && !error ? (
          <p className="mt-3 text-sm text-neutral-600">
            Belum ada booking — catat hasil negosiasi WA pertama di atas.
          </p>
        ) : null}
        {items.length > 0 && visibleItems.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">
            {query.trim()
              ? filter === "all"
                ? `Tidak ada hasil untuk "${query.trim()}".`
                : `Tidak ada hasil untuk "${query.trim()}" dengan status ${BOOKING_FILTER_LABEL[filter]}.`
              : "Tidak ada booking dengan status ini."}
          </p>
        ) : null}
        {upcoming.length > 0 ? (
          <section aria-label="Booking mendatang" className="mt-4">
            <h3 className="text-sm font-bold">Mendatang</h3>
            <ul className="mt-2 space-y-2">
              {upcomingWindow.visible.map(renderRow)}
            </ul>
            {upcomingWindow.hidden > 0 ? (
              <button
                type="button"
                onClick={() => setRevealedUpcoming((n) => n + LIST_PAGE_SIZE)}
                className="mt-3 rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold transition hover:bg-neutral-100"
              >
                Muat lebih banyak ({upcomingWindow.hidden} lagi)
              </button>
            ) : null}
          </section>
        ) : null}
        {history.length > 0 ? (
          <section aria-label="Riwayat booking" className="mt-6">
            <h3 className="text-sm font-bold">Riwayat</h3>
            <ul className="mt-2 space-y-2">
              {historyWindow.visible.map(renderRow)}
            </ul>
            {historyWindow.hidden > 0 ? (
              <button
                type="button"
                onClick={() => setRevealedHistory((n) => n + LIST_PAGE_SIZE)}
                className="mt-3 rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold transition hover:bg-neutral-100"
              >
                Muat lebih banyak ({historyWindow.hidden} lagi)
              </button>
            ) : null}
          </section>
        ) : null}
      </Dialog>

      <InvoiceDialog
        booking={invoiceBooking}
        invoices={invoiceBookingInvoices}
        business={invoiceBusinessDetails}
        businessLoadFailed={businessLoadFailed}
        onCreated={onInvoiceCreated}
        onUpdated={onInvoiceUpdated}
        onDeleted={onInvoiceDeleted}
        onClose={closeInvoices}
        returnFocusTo={triggerRef}
        restoreFocus={false}
      />
    </div>
  );
}
