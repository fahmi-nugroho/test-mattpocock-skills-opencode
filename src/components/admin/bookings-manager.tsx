"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
} from "@/lib/admin/invoice";
import {
  LIST_PAGE_SIZE,
  splitByToday,
  windowRows,
} from "@/lib/admin/list-window";
import { summarizeBookings } from "@/lib/admin/overview";
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
  listBookingsAdmin,
  setBookingStatus,
  updateBooking,
} from "@/lib/supabase/admin-bookings";
import { listInvoicesAdmin } from "@/lib/supabase/admin-invoices";
import { linkBookingRequest } from "@/lib/supabase/admin-requests";
import { getSettings } from "@/lib/supabase/admin-settings";
import { listServicesAdmin } from "@/lib/supabase/admin-services";
import { notifyScheduleChanged, SCHEDULE_CHANGED_EVENT } from "@/lib/admin/schedule-events";
import { Dialog } from "@/components/dialog";
import { InvoiceDialog } from "./invoice-dialog";
import { StyleReferenceFacts } from "./style-reference-facts";
import type {
  Booking,
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
  // A row op's failure, kept with the row it belongs to so the reason appears
  // in that row even when the dialog shows twenty of them.
  const [rowError, setRowError] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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

  const serviceNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of services) map.set(s.id, s.name);
    return map;
  }, [services]);
  const serviceName = useMemo(
    () => (id: string | null) =>
      id ? (serviceNames.get(id) ?? "Layanan dihapus") : "—",
    [serviceNames],
  );

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
  // 0018 stores "" when the service is gone; mirror that in the snapshot so
  // the duplicate guard compares what the database would actually save.
  const invoiceServiceName = invoiceBooking?.service_id
    ? (serviceNames.get(invoiceBooking.service_id) ?? "")
    : "";
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
          serviceName(item.service_id),
          item.notes,
          BOOKING_STATUS_LABEL[item.status],
        ],
      ),
    [items, filter, query, serviceName],
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

  /**
   * Open a Booking's invoices. The shared dialog is single-instance, so the
   * booking list closes in the same update; two stacked overlays would share
   * one Escape handler.
   */
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
    let cancelled = false;
    async function load() {
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
        if (!cancelled) {
          setItems(bookings);
          setServices(serviceRows);
          setInvoices(invoiceRows);
          setSettings(businessResult.row);
          setBusinessLoadFailed(businessResult.failed);
          setMirrorTracked(mirror.tracked);
          setMirrorWork(mirror.work);
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

  // Closing the invoice dialog reopens the booking list in the same update.
  // The list's own effect has already moved focus into its panel by now, so the
  // dialog's trigger (the row's invoice action) takes focus back afterwards.
  useEffect(() => {
    if (!listOpen) return;
    const bookingId = pendingInvoiceFocusRef.current;
    if (!bookingId) return;
    pendingInvoiceFocusRef.current = null;
    invoiceButtonRefs.current
      .get(bookingId)
      ?.focus({ preventScroll: true });
  }, [listOpen]);

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
      // One ordering rule now: the dialog's Mendatang/Riwayat split sorts
      // whatever is loaded, so a create no longer re-sorts here.
      setItems((prev) => [...prev, row]);
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
      // Google work happens after the local save has fully succeeded and is
      // never awaited by this form, so a slow or broken Google cannot block it.
      void drainAndRefreshMirror();
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
      setRowError({
        id: item.id,
        message: err instanceof Error ? err.message : "Input tidak valid",
      });
      return;
    }
    setRowBusy(item.id);
    try {
      const row = await updateBooking(supabaseBrowser(), item.id, validated);
      // Same one ordering rule: the split orders the list, not this save.
      setItems((prev) => prev.map((p) => (p.id === item.id ? row : p)));
      setEditingId(null);
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
      // The FK cascades in the database; the loaded list follows at once.
      setInvoices((prev) => prev.filter((row) => row.booking_id !== item.id));
      notifyScheduleChanged();
      // The Booking row is gone; its tracked row survives so the drain can
      // still delete the Google event.
      void drainAndRefreshMirror();
      setConfirmDeleteId(null);
      if (editingId === item.id) setEditingId(null);
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
    return (
      <li
        key={item.id}
        className="rounded-xl border border-neutral-200 bg-white p-3"
      >
        {editingId === item.id ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Tanggal</span>
              <input
                type="date"
                value={editFields.date}
                onChange={(e) =>
                  setEditFields((f) => ({ ...f, date: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
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
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
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
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
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
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
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
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
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
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
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
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
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
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Lokasi</span>
              <input
                type="text"
                value={editFields.venue}
                onChange={(e) =>
                  setEditFields((f) => ({ ...f, venue: e.target.value }))
                }
                placeholder="Gedung / alamat"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
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
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Total harga (Rp)</span>
              <input
                type="number"
                min={0}
                value={editFields.total_price}
                onChange={(e) =>
                  setEditFields((f) => ({
                    ...f,
                    total_price: e.target.value,
                  }))
                }
                placeholder="Kosongkan bila belum disepakati"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">DP (Rp)</span>
              <input
                type="number"
                min={0}
                value={editFields.dp_amount}
                onChange={(e) =>
                  setEditFields((f) => ({
                    ...f,
                    dp_amount: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">Catatan</span>
              <input
                type="text"
                value={editFields.notes}
                onChange={(e) =>
                  setEditFields((f) => ({ ...f, notes: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
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
          <button
            ref={(el) => {
              if (el) invoiceButtonRefs.current.set(item.id, el);
              else invoiceButtonRefs.current.delete(item.id);
            }}
            type="button"
            onClick={() => openInvoices(item)}
            aria-haspopup="dialog"
            className="rounded-full border border-neutral-900 px-4 py-1.5 text-xs font-semibold transition hover:bg-neutral-100"
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

      <form
        onSubmit={onCreate}
        className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5"
      >
        <h3 className="text-sm font-bold">Tambah booking</h3>
        <fieldset className="min-w-0 space-y-3">
          <legend className="text-sm font-semibold">Jadwal</legend>
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
              <span className="text-sm font-medium">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BookingStatus)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
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
        <fieldset className="min-w-0 space-y-3">
          <legend className="text-sm font-semibold">Klien</legend>
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
        </fieldset>
        <fieldset className="min-w-0 space-y-3">
          <legend className="text-sm font-semibold">
            Layanan dan detail acara
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
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
                        onChange={() => {
                          setHairdo(value);
                          setLegacyPrefillHairdo("");
                        }}
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
                onChange={(e) => setReference(e.target.value)}
                placeholder="Link foto atau deskripsi singkat"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </fieldset>
        <fieldset className="min-w-0 space-y-3">
          <legend className="text-sm font-semibold">
            Pembayaran dan catatan
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
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
            {createRemaining !== null ? (
              <p className="text-sm text-neutral-600 sm:col-span-2">
                Sisa pembayaran: {formatIDR(createRemaining)}
              </p>
            ) : null}
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
          </div>
        </fieldset>
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

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setListOpen(true)}
        aria-haspopup="dialog"
        className="mt-4 flex w-full flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-left transition hover:bg-neutral-50"
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
        serviceName={invoiceServiceName}
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
