"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { filterByQuery } from "@/lib/admin/filter-items";
import {
  BOOKING_REQUEST_COPY_FAILURE,
  BOOKING_REQUEST_CORRECT_NOTICE,
  BOOKING_REQUEST_DELETE_WARNING,
  BOOKING_REQUEST_FILTERS,
  BOOKING_REQUEST_FILTER_LABEL,
  BOOKING_REQUEST_REISSUE_NOTICE,
  BOOKING_REQUEST_STATUS_LABEL,
  bookingRequestCanReissue,
  bookingRequestCanResend,
  bookingRequestCorrectRefusal,
  bookingRequestDeleteRefusal,
  bookingRequestRefusalHint,
  buildFormatBookingLink,
  deriveBookingRequestState,
  filterBookingRequests,
  requestToBookingDraft,
  requestToReissuePrefill,
  type BookingRequestFilter,
  type BookingRequestPrefillInput,
  type BookingRequestStatus,
} from "@/lib/admin/booking-request";
import { notifyAcceptRequest } from "@/lib/admin/request-events";
import {
  LIST_PAGE_SIZE,
  windowRows,
} from "@/lib/admin/list-window";
import { SCHEDULE_CHANGED_EVENT } from "@/lib/admin/schedule-events";
import { buildFormatBookingWaLink } from "@/lib/whatsapp";
import { Dialog } from "@/components/dialog";
import { StyleReferenceFacts } from "./style-reference-facts";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  correctBookingRequest,
  createBookingRequest,
  deleteBookingRequest,
  listBookingRequestsAdmin,
} from "@/lib/supabase/admin-requests";
import type { BookingRequest } from "@/lib/supabase/database";

const STATUS_STYLE: Record<BookingRequestStatus, string> = {
  open: "bg-neutral-100 text-neutral-700",
  submitted: "bg-amber-100 text-amber-800",
  accepted: "bg-green-100 text-green-800",
  expired: "bg-red-100 text-red-700",
};

/**
 * Write text to the clipboard, shared by the created-panel and per-row copy
 * actions so one operation has one failure path. Throws when the browser has
 * no clipboard; callers turn that into the Indonesian copy failure.
 */
async function writeToClipboard(text: string): Promise<void> {
  if (!navigator.clipboard) {
    throw new Error("Clipboard tidak tersedia");
  }
  await navigator.clipboard.writeText(text);
}

/** A per-row action that can be in flight, so only its button shows "…". */
type RowAction = "edit" | "delete" | "reissue";

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
 * linked or released request updates its badge without a reload. Each row also
 * shows the request's Style and Reference (booking-request-style-and-reference
 * ticket 04), an empty one shown as absent. A roving-tablist row of chips
 * (booking-request-admin-actions ticket 02) narrows the list to one derived
 * state — reusing the same `deriveBookingRequestState` the badge and the accept
 * guard read — and composes with the search box rather than replacing it. Each
 * row can also be deleted (admin-actions ticket 03) after a two-click confirm,
 * behind the guarded adapter that refuses a request already turned into a
 * Booking and points at deleting the Booking instead; a deleted row leaves the
 * list at once, and no schedule event is dispatched because a request never
 * occupies the calendar. Each row's admin-owned prefill (the client's
 * name and the requested slot) can also be corrected in place while the row is
 * open — behind the guarded adapter that refuses anything already answered or
 * lapsed, so a stale screen cannot rewrite a client's own request — and the
 * saved row keeps the same token and link (admin-actions ticket 04). A lapsed
 * row instead offers "Buat link baru" (admin-actions ticket 05), which reuses
 * the create path to make a fresh request carrying only the name and slot, with
 * a new token and a fresh seven-day window; the old row is left untouched as
 * history, so a dead token is never revived.
 *
 * A row whose link is still live (open or answered) also offers re-sending it
 * (admin-actions ticket 06): copying it again needs no stored state, and
 * opening WhatsApp prefills a number typed into a per-row field that is never
 * written to the database — pre-filled from the client's own number, so an
 * answered request is one tap. Both actions are hidden once the link is spent
 * (accepted) or lapsed, where re-issuing is the route instead.
 *
 * The list itself lives in a dialog (form-layout-polish ticket 03): the
 * section keeps the link form and shows the "perlu ditindak" count plus a
 * trigger, while the dialog holds the badge, the refresh, the chips, the
 * search, the rows and every row action, capped at ten rows over whatever the
 * chip and the search currently match. Opening it fetches nothing.
 *
 * The load is hoisted out of its effect (admin-actions ticket 07) so the
 * section's own "Muat ulang" button can pull in a request that arrived while
 * the tab stayed open, without a page reload. The in-flight flag is separate
 * from the initial load, so a refresh keeps the list readable instead of
 * blanking it behind a loading message, and the badge count is recomputed from
 * the same rows, so it can never disagree with the list. No realtime and no
 * background polling: the refresh stays a manual decision, and the existing
 * cross-panel schedule signal keeps refetching through the same load.
 */
export function RequestsManager({
  onAttentionCountChange,
}: RequestsManagerProps) {
  const [items, setItems] = useState<BookingRequest[]>([]);
  // First load only — a reload flips `refreshing` instead, so it never blanks.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<BookingRequestFilter>("all");
  // The list lives in a dialog (form-layout-polish ticket 03); the section
  // keeps the link form and shows a summary plus this trigger.
  const [listOpen, setListOpen] = useState(false);
  // How many filtered rows have been revealed; reset on every chip or search
  // change so a narrowed list always opens at one page.
  const [revealed, setRevealed] = useState(LIST_PAGE_SIZE);
  // The "Jadikan Booking" close navigates to the form, so that one close must
  // not pull focus back down to the trigger.
  const [skipReturnFocus, setSkipReturnFocus] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // A row op in flight: which row and which action, so only that action's
  // button shows a busy label while the row's controls are disabled. Re-issue
  // joins delete and edit here.
  const [rowBusy, setRowBusy] = useState<{
    id: string;
    action: RowAction;
  } | null>(null);
  const [rowError, setRowError] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  // The per-row re-send number (ticket 06), keyed by request id. Never written
  // to the database, mirroring the link form's "not stored" decision; an
  // absent entry means "use the client's own number", so an answered request
  // is one tap. A map (not a single editing id) keeps every live row's field
  // independent.
  const [resendNumbers, setResendNumbers] = useState<Record<string, string>>(
    {},
  );
  const filterRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // The rows' live links are built from the browser origin. RequestsManager
  // only mounts after the admin page's auth effect, so `window` is present; a
  // guard keeps a stray server render from throwing, and one `origin` keeps
  // every link builder reading the same value.
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  // The derived state is clock-dependent, so pin one clock per list load: every
  // row's badge and state label then come from the same moment.
  const now = useMemo(() => new Date(), [items]);

  // The chosen chip runs first through the pure `filterBookingRequests` — which
  // derives each request with `now` through the same `deriveBookingRequestState`
  // the badge and the accept guard read — and the client-side search then
  // narrows that subset, so a row must match both the chip and the query.
  const visibleRows = useMemo(
    () =>
      filterByQuery(
        filterBookingRequests(items, filter, now).map((item) => ({
          item,
          status: deriveBookingRequestState(item, now),
        })),
        query,
        (row) => [
          row.item.client_name,
          row.item.client_phone,
          row.item.event_type,
          row.item.venue,
          row.item.hairdo,
          row.item.reference,
          row.item.notes,
          row.item.date,
          BOOKING_REQUEST_STATUS_LABEL[row.status],
        ],
      ),
    [items, filter, now, query],
  );

  // One cap over whatever the chip and the search currently match — the
  // Permintaan list has no date grouping.
  const listWindow = windowRows(visibleRows, revealed);

  /** Changing the chip (or clearing it after a re-issue) opens one page. */
  function changeFilter(next: BookingRequestFilter) {
    setFilter(next);
    setRevealed(LIST_PAGE_SIZE);
  }

  /** Changing the search text opens one page too. */
  function changeQuery(next: string) {
    setQuery(next);
    setRevealed(LIST_PAGE_SIZE);
  }

  // Roving tabindex for the chip tablist: arrow keys move the selection (and
  // therefore the single tab stop) between chips, Home/End jump to the ends.
  function onFilterKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const last = BOOKING_REQUEST_FILTERS.length - 1;
    const current = BOOKING_REQUEST_FILTERS.indexOf(filter);
    let next: number | null = null;
    if (e.key === "ArrowRight") next = current === last ? 0 : current + 1;
    else if (e.key === "ArrowLeft") next = current === 0 ? last : current - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    changeFilter(BOOKING_REQUEST_FILTERS[next]);
    filterRefs.current[next]?.focus();
  }

  // A load that finishes after unmount must not touch state — the guard the
  // effect held before `load` was hoisted out so the refresh button could call
  // it.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Load the list through the admin adapter and update everything derived from
   * it in one pass (ticket 07): the mount, the section's "Muat ulang" button,
   * and the cross-panel schedule signal all share this one path, so the badge
   * count is always recomputed from the same rows that fill the list and the
   * two can never disagree. `loading` is the one-time first load and never
   * turns back on; `refreshing` is the in-flight flag a reload sets, so the
   * list never blanks behind a loading message.
   */
  const load = useCallback(async () => {
    try {
      const rows = await listBookingRequestsAdmin(supabaseBrowser());
      if (!mountedRef.current) return;
      setItems(rows);
      // "Needs action" is the chip vocabulary's own name for what the badge
      // counts, so reuse the filter rather than re-deriving the predicate.
      const count = filterBookingRequests(rows, "needs_action", new Date())
        .length;
      setAttentionCount(count);
      onAttentionCountChange?.(count);
      setError(null);
    } catch {
      if (mountedRef.current) setError("Gagal memuat permintaan. Coba lagi.");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [onAttentionCountChange]);

  useEffect(() => {
    load();
    // A booking created/deleted elsewhere changes accepted_booking_id (the
    // FK is on delete set null), so refetch to show accepted / released.
    const onChange = () => load();
    window.addEventListener(SCHEDULE_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener(SCHEDULE_CHANGED_EVENT, onChange);
    };
  }, [load]);

  /** Pull in anything that arrived while the tab was open, without a reload. */
  function onRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    load();
  }

  /** Whether the row's given action is the one currently in flight. */
  const busyOn = (id: string, action: RowAction) =>
    rowBusy?.id === id && rowBusy.action === action;

  /**
   * Create a request through the shared adapter and surface its fresh link in
   * the created panel. Both the link form and re-issue use it, so each builds
   * the same `/request/<token>` link from the row's brand-new token.
   */
  async function createAndSurface(
    input: BookingRequestPrefillInput,
    sendTo: string,
  ): Promise<BookingRequest> {
    const row = await createBookingRequest(supabaseBrowser(), input);
    const link = buildFormatBookingLink(origin, row.token);
    setCreated({ link, waNumber: sendTo });
    return row;
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreateError(null);
    setCopiedLink(null);
    setCreating(true);
    try {
      const row = await createAndSurface(
        {
          client_name: clientName,
          date: date || null,
          start_time: start || null,
          end_time: end || null,
        },
        waNumber.trim(),
      );
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
      await writeToClipboard(link);
      setCopiedLink(link);
    } catch {
      setCreateError(BOOKING_REQUEST_COPY_FAILURE);
    }
  }

  /**
   * Copy a live row's link again (ticket 06). It needs no stored state — no
   * column, no saved number — so this is a plain clipboard write; a browser
   * that refuses it reports the failure in the row, in Indonesian.
   */
  async function onCopyResend(item: BookingRequest) {
    setRowError(null);
    const link = buildFormatBookingLink(origin, item.token);
    try {
      await writeToClipboard(link);
      setCopiedLink(link);
    } catch {
      setRowError({ id: item.id, message: BOOKING_REQUEST_COPY_FAILURE });
    }
  }

  function onAccept(item: BookingRequest) {
    notifyAcceptRequest({
      requestId: item.id,
      draft: requestToBookingDraft(item),
    });
    setSkipReturnFocus(true);
    setListOpen(false);
    window.location.hash = "#booking";
  }

  /**
   * Two deliberate clicks: the first arms the row's delete (and shows the
   * warning that the client's link dies with it), the second deletes. The
   * guarded adapter refuses an accepted request, whose message surfaces in the
   * row; a deleted request leaves the list at once, and the attention count is
   * recomputed from the new list so the badge never disagrees with it. A
   * request never occupies the calendar, so no schedule event is dispatched.
   */
  async function onDelete(item: BookingRequest) {
    if (confirmDeleteId !== item.id) {
      setRowError(null);
      setConfirmDeleteId(item.id);
      return;
    }
    if (rowBusy) return;
    setRowError(null);
    setRowBusy({ id: item.id, action: "delete" });
    try {
      await deleteBookingRequest(supabaseBrowser(), item.id);
      const next = items.filter((row) => row.id !== item.id);
      setItems(next);
      const count = filterBookingRequests(next, "needs_action", now).length;
      setAttentionCount(count);
      onAttentionCountChange?.(count);
      setConfirmDeleteId(null);
    } catch (err) {
      setRowError({
        id: item.id,
        message:
          err instanceof Error
            ? err.message
            : "Gagal menghapus permintaan. Coba lagi.",
      });
      setConfirmDeleteId(null);
    } finally {
      setRowBusy(null);
    }
  }

  /**
   * Inline prefill correction for an open row (ticket 04): load the editable
   * fields, save through the guarded adapter, and swap the updated row in place
   * so the same token and link keep working. Only the open row offers this; the
   * adapter refuses anything already answered or lapsed and its Indonesian
   * message surfaces in the row.
   */
  function onStartEdit(item: BookingRequest) {
    setRowError(null);
    setConfirmDeleteId(null);
    setEditingId(item.id);
    setEditName(item.client_name);
    setEditDate(item.date ?? "");
    setEditStart(item.start_time ?? "");
    setEditEnd(item.end_time ?? "");
  }

  function onCancelEdit() {
    setEditingId(null);
    setRowError(null);
  }

  async function onSaveEdit(item: BookingRequest) {
    if (rowBusy) return;
    setRowError(null);
    setRowBusy({ id: item.id, action: "edit" });
    try {
      const updated = await correctBookingRequest(supabaseBrowser(), item.id, {
        client_name: editName,
        date: editDate || null,
        start_time: editStart || null,
        end_time: editEnd || null,
      });
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? updated : row)),
      );
      setEditingId(null);
    } catch (err) {
      setRowError({
        id: item.id,
        message:
          err instanceof Error
            ? err.message
            : "Gagal memperbarui permintaan. Coba lagi.",
      });
    } finally {
      setRowBusy(null);
    }
  }

  /**
   * Re-issue a lapsed link (ticket 05): a client who never answered can be
   * asked again. This calls the same create path the link form calls, so the
   * fresh request gets a brand-new token and the database's fresh seven-day
   * window, and nothing about the old row is written. It carries only the name
   * and the requested slot — the client must fill the rest in again. The new row
   * is prepended, and the filter drops back to "all" so the fresh open row is
   * visible at once alongside the old lapsed one kept as history. No WhatsApp
   * number is carried over: the old row's number is the client's, not the
   * admin's, and the fresh request has not been answered yet.
   */
  async function onReissue(item: BookingRequest) {
    if (rowBusy) return;
    setRowError(null);
    setConfirmDeleteId(null);
    setCopiedLink(null);
    setRowBusy({ id: item.id, action: "reissue" });
    try {
      const row = await createAndSurface(requestToReissuePrefill(item), "");
      changeFilter("all");
      setItems((prev) => [row, ...prev]);
    } catch (err) {
      setRowError({
        id: item.id,
        message:
          err instanceof Error
            ? err.message
            : "Gagal membuat link baru. Coba lagi.",
      });
    } finally {
      setRowBusy(null);
    }
  }

  /** One Booking Request row, with every action and message it carries. */
  function renderRow(item: BookingRequest, status: BookingRequestStatus) {
    const isEditing = editingId === item.id;
    const correctRefusal = bookingRequestCorrectRefusal(status);
    const resendNumber = resendNumbers[item.id] ?? item.client_phone;
    const resendLink = buildFormatBookingLink(origin, item.token);
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
          {isEditing ? (
            <label className="flex flex-col">
              <span className="text-sm font-medium">
                Nama klien (opsional)
              </span>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nama klien"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
          ) : (
            <span className="text-sm font-semibold">
              {item.client_name || "Tanpa nama"}
            </span>
          )}
          <span className="text-xs text-neutral-500">
            {item.client_phone || "—"}
          </span>
        </div>
        <p className="mt-1 text-xs text-neutral-600">
          {item.event_type || "—"} · {item.headcount} orang ·{" "}
          {item.venue || "—"}
        </p>
        <StyleReferenceFacts
          hairdo={item.hairdo}
          reference={item.reference}
        />
        {isEditing ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium">
                Tanggal (opsional)
              </span>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">
                Jam mulai (opsional)
              </span>
              <input
                type="time"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">
                Jam selesai (opsional)
              </span>
              <input
                type="time"
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
        ) : (
          <p className="mt-0.5 text-xs text-neutral-600">
            Diminta:{" "}
            {item.date
              ? `${item.date} · ${item.start_time ?? "—"}–${item.end_time ?? "—"}`
              : "belum ditentukan"}
          </p>
        )}
        {item.notes ? (
          <p className="mt-1 text-xs text-neutral-600">{item.notes}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-start gap-3">
          <div>
            {correctRefusal === null ? (
              isEditing ? (
                <>
                  <button
                    type="button"
                    disabled={rowBusy?.id === item.id}
                    onClick={() => onSaveEdit(item)}
                    className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {busyOn(item.id, "edit") ? "Menyimpan…" : "Simpan"}
                  </button>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="ml-2 rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold"
                  >
                    Batal
                  </button>
                  <p className="mt-1 text-xs text-neutral-500">
                    {BOOKING_REQUEST_CORRECT_NOTICE}
                  </p>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onStartEdit(item)}
                  className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold"
                >
                  Ubah
                </button>
              )
            ) : (
              <div>
                <button
                  type="button"
                  disabled
                  className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold opacity-50"
                >
                  Ubah
                </button>
                <p className="mt-1 text-xs text-neutral-500">
                  {correctRefusal}
                </p>
              </div>
            )}
          </div>
          <div>
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
          {bookingRequestCanResend(status) ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onCopyResend(item)}
                className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold transition hover:bg-neutral-100"
              >
                {copiedLink === resendLink ? "Tersalin" : "Salin link"}
              </button>
              <input
                type="tel"
                aria-label="Nomor WhatsApp untuk kirim ulang"
                value={resendNumber}
                onChange={(e) =>
                  setResendNumbers((prev) => ({
                    ...prev,
                    [item.id]: e.target.value,
                  }))
                }
                placeholder="08… (tidak disimpan)"
                className="w-40 rounded-lg border border-neutral-300 px-2 py-1.5 text-xs"
              />
              {resendNumber.trim() ? (
                <a
                  href={buildFormatBookingWaLink(resendNumber, resendLink)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-700"
                >
                  Kirim via WhatsApp
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Isi nomor WhatsApp dulu"
                  className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white opacity-50"
                >
                  Kirim via WhatsApp
                </button>
              )}
            </div>
          ) : null}
          {bookingRequestCanReissue(status) ? (
            <div>
              <button
                type="button"
                disabled={rowBusy?.id === item.id}
                onClick={() => onReissue(item)}
                className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold disabled:opacity-60"
              >
                {busyOn(item.id, "reissue")
                  ? "Membuat…"
                  : "Buat link baru"}
              </button>
              <p className="mt-1 text-xs text-neutral-500">
                {BOOKING_REQUEST_REISSUE_NOTICE}
              </p>
            </div>
          ) : null}
          <div>
            {bookingRequestDeleteRefusal(status) === null ? (
              <>
                <button
                  type="button"
                  disabled={rowBusy?.id === item.id}
                  onClick={() => onDelete(item)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-60 ${
                    confirmDeleteId === item.id
                      ? "bg-red-600 text-white"
                      : "border border-red-300 text-red-700"
                  }`}
                >
                  {busyOn(item.id, "delete")
                    ? "Menghapus…"
                    : confirmDeleteId === item.id
                      ? "Klik lagi untuk hapus"
                      : "Hapus"}
                </button>
                {confirmDeleteId === item.id ? (
                  <p className="mt-1 text-xs text-red-700">
                    {BOOKING_REQUEST_DELETE_WARNING}
                  </p>
                ) : null}
              </>
            ) : (
              <div>
                <button
                  type="button"
                  disabled
                  className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold opacity-50"
                >
                  Hapus
                </button>
                <p className="mt-1 text-xs text-neutral-500">
                  {bookingRequestDeleteRefusal(status)}
                </p>
              </div>
            )}
          </div>
          {rowError?.id === item.id ? (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {rowError.message}
            </p>
          ) : null}
        </div>
      </li>
    );
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
        className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5"
      >
        <h3 className="text-sm font-bold">Buat link Format Booking</h3>
        <fieldset className="min-w-0 space-y-3">
          <legend className="text-sm font-semibold">
            Klien dan pengiriman
          </legend>
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
          </div>
        </fieldset>
        <fieldset className="min-w-0 space-y-3">
          <legend className="text-sm font-semibold">
            Jadwal opsional
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">Tanggal (opsional)</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
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
        </fieldset>
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

      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setSkipReturnFocus(false);
          setListOpen(true);
        }}
        aria-haspopup="dialog"
        className="mt-5 flex w-full flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-left transition hover:bg-neutral-50"
      >
        <span>
          <span className="block text-sm font-semibold">
            Lihat daftar permintaan
          </span>
          <span className="mt-0.5 block text-xs text-neutral-600">
            {attentionCount} perlu ditindak
          </span>
        </span>
        <span aria-hidden="true" className="ml-auto text-lg">
          ›
        </span>
      </button>

      <Dialog
        open={listOpen}
        onClose={() => setListOpen(false)}
        title="Daftar permintaan"
        returnFocusTo={triggerRef}
        restoreFocus={!skipReturnFocus}
        panelClassName="sm:max-w-3xl"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              attentionCount > 0
                ? "bg-amber-100 text-amber-800"
                : "bg-neutral-100 text-neutral-600"
            }`}
          >
            {attentionCount} perlu ditindak
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="ml-auto rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold transition hover:bg-neutral-100 disabled:opacity-60"
          >
            {refreshing ? "Memuat…" : "Muat ulang"}
          </button>
        </div>

        <div
          className="mt-4 flex flex-wrap gap-2"
          role="tablist"
          aria-label="Filter status permintaan"
          onKeyDown={onFilterKeyDown}
        >
          {BOOKING_REQUEST_FILTERS.map((value, index) => {
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
                {BOOKING_REQUEST_FILTER_LABEL[value]}
              </button>
            );
          })}
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => changeQuery(e.target.value)}
          placeholder="Cari permintaan…"
          aria-label="Cari permintaan"
          className="mt-4 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
        />

        <ul className="mt-4 space-y-2">
          {listWindow.visible.map(({ item, status }) => renderRow(item, status))}
        </ul>
        {listWindow.hidden > 0 ? (
          <button
            type="button"
            onClick={() => setRevealed((n) => n + LIST_PAGE_SIZE)}
            className="mt-3 rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-semibold transition hover:bg-neutral-100"
          >
            Muat lebih banyak ({listWindow.hidden} lagi)
          </button>
        ) : null}
        {items.length === 0 && !error ? (
          <p className="mt-3 text-sm text-neutral-600">
            Belum ada permintaan — buat link pertama di atas.
          </p>
        ) : null}
        {items.length > 0 && visibleRows.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">
            {query.trim()
              ? `Tidak ada hasil untuk "${query.trim()}".`
              : "Tidak ada permintaan dengan status ini."}
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}
