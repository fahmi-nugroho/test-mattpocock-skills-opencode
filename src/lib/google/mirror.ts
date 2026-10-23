import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Booking,
  Database,
  GoogleCalendarEventRow,
  GoogleCalendarOperation,
  GoogleCalendarWorkRow,
  Service,
} from "../supabase/database";
import {
  getConnection,
  getEnabledConnection,
  setConnectionError,
  type MirrorRuntimeFactory,
} from "./calendar-connection";
import type { MirrorReconcileSummary } from "./mirror-summary";
import {
  buildMirrorEvent,
  mirrorTodayKey,
  planBackfill,
  planMirrorWork,
} from "./mirror-projection";
import type { GoogleCalendarPort } from "./port";
import { enqueueMirrorWork } from "../supabase/admin-mirror";

type TypedClient = SupabaseClient<Database>;

/**
 * The Calendar Mirror adapter (tickets 02-03).
 *
 * A Booking save only leaves an intent in `google_calendar_work`; this module
 * is what a Node-runtime admin or cron route calls to turn those intents into
 * Google events. Reconcile plans the whole today-forward desired state and
 * drains it through the same path. The Google port is injected, so every
 * decision — create, update, delete, retry, backfill — is testable without
 * credentials or network.
 *
 * Guarantees:
 * - one event per Booking: the tracked row stores the Google id immediately
 *   after create, and the drain re-reads it after taking a per-Booking claim;
 * - a Google failure never throws into the save path: the intent stays open
 *   with its error, and a later drain retries it;
 * - past Bookings are never backfilled, and already-tracked Bookings are not
 *   created again, so a repeated drain is safe.
 */

const EVENTS_TABLE = "google_calendar_events";
const WORK_TABLE = "google_calendar_work";
const RETRY_DELAY_MS = 5 * 60_000;
// The queue's next_attempt_at comes from the database clock, while a drain
// compares it with the Node clock. A small grace keeps a just-enqueued row
// from looking "not due yet" when the database clock is a second ahead.
const DUE_GRACE_MS = 60_000;

export type MirrorWorkOutcome =
  | "created"
  | "updated"
  | "deleted"
  | "skipped"
  | "failed";

export interface MirrorWorkResult {
  bookingId: string;
  operation: GoogleCalendarOperation;
  outcome: MirrorWorkOutcome;
  error: string | null;
}

export interface MirrorDrainResult {
  ok: boolean;
  results: MirrorWorkResult[];
  /** Intents newly queued by the today-forward backfill in this drain. */
  backfilled: number;
  failed: number;
  error: string | null;
}

export type { MirrorReconcileSummary };

interface DrainOptions {
  /**
   * Reconcile sets false: ownership is the tracked row's event id, so it never
   * lists marker-only Google events and cannot touch an event a human made.
   */
  adoptOwned?: boolean;
  /**
   * Reconcile sets true: leave open work for a past Booking alone. An orphaned
   * work row has no Booking date, so it is still processed.
   */
  onlyTodayForward?: boolean;
}

function emptySummary(
  overrides: Partial<MirrorReconcileSummary> = {},
): MirrorReconcileSummary {
  return {
    ok: true,
    disabled: false,
    created: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
    failed: 0,
    error: null,
    ...overrides,
  };
}

function errorText(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return fallback;
}

/**
 * Google answers a hand-deleted mirrored event with 404. That is not a mirror
 * failure: reconcile recreates the event for a confirmed Booking, and treats
 * the delete as done when the Booking should no longer be mirrored.
 */
function isMissingEventError(error: unknown): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    (error as { status?: unknown }).status === 404
  ) {
    return true;
  }
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("tidak ditemukan") ||
    message.includes("not found") ||
    message.includes("status 404")
  );
}

async function listRows<T>(client: TypedClient, table: string): Promise<T[]> {
  const loose = client as unknown as {
    from(name: string): {
      select(columns: string): Promise<{
        data: unknown;
        error: { message: string } | null;
      }>;
    };
  };
  const { data, error } = await loose.from(table).select("*");
  if (error) throw new Error(`Gagal memuat data sinkronisasi Google: ${error.message}`);
  return Array.isArray(data) ? (data as T[]) : [];
}

async function getBooking(
  client: TypedClient,
  id: string,
): Promise<Booking | null> {
  const loose = client as unknown as {
    from(name: string): {
      select(columns: string): {
        eq(column: string, value: string): {
          maybeSingle(): Promise<{
            data: unknown;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  const { data, error } = await loose
    .from("bookings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat booking: ${error.message}`);
  return (data as Booking | null) ?? null;
}

async function getServiceName(
  client: TypedClient,
  serviceId: string,
): Promise<string | null> {
  const loose = client as unknown as {
    from(name: string): {
      select(columns: string): {
        eq(column: string, value: string): {
          maybeSingle(): Promise<{
            data: unknown;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  const { data, error } = await loose
    .from("services")
    .select("name")
    .eq("id", serviceId)
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat layanan: ${error.message}`);
  return (data as Pick<Service, "name"> | null)?.name ?? null;
}

/** Re-read after the claim: this is the decision that prevents duplicates. */
async function getTrackedEvent(
  client: TypedClient,
  bookingId: string,
): Promise<GoogleCalendarEventRow | null> {
  const loose = client as unknown as {
    from(name: string): {
      select(columns: string): {
        eq(column: string, value: string): {
          maybeSingle(): Promise<{
            data: unknown;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  const { data, error } = await loose
    .from(EVENTS_TABLE)
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat event Google: ${error.message}`);
  return (data as GoogleCalendarEventRow | null) ?? null;
}

async function storeTrackedEvent(
  client: TypedClient,
  bookingId: string,
  googleEventId: string,
  now: Date,
): Promise<void> {
  const loose = client as unknown as {
    from(name: string): {
      upsert(
        values: Record<string, unknown>,
        options?: unknown,
      ): Promise<{ error: { message: string } | null }>;
    };
  };
  const { error } = await loose.from(EVENTS_TABLE).upsert(
    {
      booking_id: bookingId,
      google_event_id: googleEventId,
      last_synced_at: now.toISOString(),
    },
    { onConflict: "booking_id" },
  );
  if (error) throw new Error(`Gagal menyimpan id event Google: ${error.message}`);
}

async function removeTrackedEvent(
  client: TypedClient,
  bookingId: string,
): Promise<void> {
  const loose = client as unknown as {
    from(name: string): {
      delete(): {
        eq(
          column: string,
          value: string,
        ): Promise<{ error: { message: string } | null }>;
      };
    };
  };
  const { error } = await loose
    .from(EVENTS_TABLE)
    .delete()
    .eq("booking_id", bookingId);
  if (error) throw new Error(`Gagal menghapus catatan event Google: ${error.message}`);
}

async function claimWork(
  client: TypedClient,
  bookingId: string,
): Promise<GoogleCalendarWorkRow | null> {
  const loose = client as unknown as {
    rpc(
      name: string,
      args: Record<string, unknown>,
    ): Promise<{
      data: unknown;
      error: { message: string } | null;
    }>;
  };
  const { data, error } = await loose.rpc("claim_google_calendar_work", {
    p_booking_id: bookingId,
  });
  if (error) {
    throw new Error(`Gagal mengunci antrean Google: ${error.message}`);
  }
  return Array.isArray(data) ? ((data[0] as GoogleCalendarWorkRow) ?? null) : null;
}

async function updateWork(
  client: TypedClient,
  bookingId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const loose = client as unknown as {
    from(name: string): {
      update(values: Record<string, unknown>): {
        eq(
          column: string,
          value: string,
        ): Promise<{ error: { message: string } | null }>;
      };
    };
  };
  const { error } = await loose
    .from(WORK_TABLE)
    .update(patch)
    .eq("booking_id", bookingId);
  if (error) throw new Error(`Gagal menyimpan antrean Google: ${error.message}`);
}

async function deleteWorkRow(
  client: TypedClient,
  bookingId: string,
): Promise<void> {
  const loose = client as unknown as {
    from(name: string): {
      delete(): {
        eq(
          column: string,
          value: string,
        ): Promise<{ error: { message: string } | null }>;
      };
    };
  };
  const { error } = await loose
    .from(WORK_TABLE)
    .delete()
    .eq("booking_id", bookingId);
  if (error) throw new Error(`Gagal menghapus antrean Google: ${error.message}`);
}

async function getWorkRow(
  client: TypedClient,
  bookingId: string,
): Promise<GoogleCalendarWorkRow | null> {
  const loose = client as unknown as {
    from(name: string): {
      select(columns: string): {
        eq(column: string, value: string): {
          maybeSingle(): Promise<{
            data: unknown;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  const { data, error } = await loose
    .from(WORK_TABLE)
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat antrean Google: ${error.message}`);
  return (data as GoogleCalendarWorkRow | null) ?? null;
}

/**
 * Did a Booking save coalesce a newer intent into the row while we held the
 * claim? The enqueue RPC keeps a fresh claim but always updates `updated_at`
 * (and possibly the operation), so either difference means the work we just
 * did was for an older Booking state and the row must stay open.
 */
async function hasNewerIntent(
  client: TypedClient,
  bookingId: string,
  claimed: GoogleCalendarWorkRow,
  operation: GoogleCalendarOperation,
): Promise<boolean> {
  try {
    const fresh = await getWorkRow(client, bookingId);
    if (!fresh || fresh.processed_at !== null) return false;
    return (
      fresh.operation !== operation || fresh.updated_at !== claimed.updated_at
    );
  } catch {
    // Unreadable bookkeeping is not proof of a newer intent; the caller's
    // processed write is idempotent if the re-read was merely unavailable.
    return false;
  }
}

interface WorkOutcome {
  outcome: Exclude<MirrorWorkOutcome, "failed">;
  error: null;
}

/**
 * Remove the mirror event for a Booking, even when the tracked row is gone.
 * The list is the safety net for a create that reached Google before its id
 * could be stored: a cancel or hard delete must not orphan that event.
 */
async function deleteMirrorEvent(
  client: TypedClient,
  port: GoogleCalendarPort,
  calendarId: string,
  bookingId: string,
  tracked: GoogleCalendarEventRow | null,
  adoptOwned: boolean,
): Promise<boolean> {
  if (tracked) {
    try {
      await port.deleteEvent(calendarId, tracked.google_event_id);
    } catch (error) {
      // Already gone in Google is exactly the state we wanted.
      if (!isMissingEventError(error)) throw error;
    }
    await removeTrackedEvent(client, bookingId);
    return true;
  }
  // A write-path retry may still look for an event that reached Google before
  // its id was stored. Reconcile does not: only the tracked id defines ownership.
  if (!adoptOwned) return false;
  const owned = await port.listOwnedEvents(calendarId, bookingId);
  if (owned.length === 0) return false;
  for (const event of owned) {
    await port.deleteEvent(calendarId, event.id);
  }
  return true;
}

/**
 * One claimed intent. The tracked row is read by the caller after the claim;
 * an upsert that finds the Booking gone or no longer confirmed becomes the
 * same delete as an explicit delete intent.
 */
async function runWork(
  client: TypedClient,
  port: GoogleCalendarPort,
  calendarId: string,
  bookingId: string,
  operation: GoogleCalendarOperation,
  tracked: GoogleCalendarEventRow | null,
  now: Date,
  adoptOwned: boolean,
): Promise<WorkOutcome> {
  if (operation === "delete") {
    const deleted = await deleteMirrorEvent(
      client,
      port,
      calendarId,
      bookingId,
      tracked,
      adoptOwned,
    );
    return { outcome: deleted ? "deleted" : "skipped", error: null };
  }

  const booking = await getBooking(client, bookingId);
  if (!booking || booking.status !== "confirmed") {
    const deleted = await deleteMirrorEvent(
      client,
      port,
      calendarId,
      bookingId,
      tracked,
      adoptOwned,
    );
    return { outcome: deleted ? "deleted" : "skipped", error: null };
  }

  const serviceName = booking.service_id
    ? await getServiceName(client, booking.service_id)
    : null;
  const draft = buildMirrorEvent(booking, serviceName);

  if (tracked) {
    try {
      await port.updateEvent(calendarId, tracked.google_event_id, draft);
    } catch (error) {
      if (!isMissingEventError(error)) throw error;
      // Hand-deleted in Google: recreate it and replace the stale tracked id.
      const created = await port.createEvent(calendarId, draft);
      await storeTrackedEvent(client, bookingId, created.id, now);
      return { outcome: "created", error: null };
    }
    await storeTrackedEvent(
      client,
      bookingId,
      tracked.google_event_id,
      now,
    );
    return { outcome: "updated", error: null };
  }

  // A previous create may have reached Google before its id could be stored.
  // The private marker finds that event so a retry updates it instead of
  // creating a duplicate. Reconcile pauses this adoption: a hand-created
  // event must never be treated as owned.
  if (adoptOwned) {
    const owned = await port.listOwnedEvents(calendarId, bookingId);
    if (owned.length > 0) {
      const eventId = owned[0].id;
      await port.updateEvent(calendarId, eventId, draft);
      await storeTrackedEvent(client, bookingId, eventId, now);
      return { outcome: "updated", error: null };
    }
  }

  const created = await port.createEvent(calendarId, draft);
  // Store the id immediately: if anything after this fails, the next drain
  // updates this event instead of making a second one.
  await storeTrackedEvent(client, bookingId, created.id, now);
  return { outcome: "created", error: null };
}

/**
 * Drain due mirror intents for the authenticated admin. Call after a Booking
 * save and from the daily cron. Refuses while the connection is disconnected;
 * individual Google failures are recorded, not thrown, so one Booking cannot
 * block the rest.
 */
export async function drainMirrorQueue(
  client: TypedClient,
  makeRuntime: MirrorRuntimeFactory,
  now: Date = new Date(),
  options: DrainOptions = {},
): Promise<MirrorDrainResult> {
  const adoptOwned = options.adoptOwned ?? true;
  await getEnabledConnection(client);

  let runtime: ReturnType<MirrorRuntimeFactory>;
  try {
    runtime = makeRuntime();
  } catch (error) {
    const message = errorText(error, "Konfigurasi Google Calendar bermasalah.");
    await setConnectionError(client, message, now);
    return { ok: false, results: [], backfilled: 0, failed: 0, error: message };
  }

  const { config, port } = runtime;

  // Backfill planning needs the current tracked set; the open work rows let a
  // failed retry keep its backoff instead of being reset by every drain.
  let workRows: GoogleCalendarWorkRow[];
  let planned: ReturnType<typeof planBackfill>;
  let bookingDates = new Map<string, string>();
  const todayKey = mirrorTodayKey(now);
  try {
    const [bookings, tracked, work] = await Promise.all([
      listRows<Booking>(client, "bookings"),
      listRows<GoogleCalendarEventRow>(client, EVENTS_TABLE),
      listRows<GoogleCalendarWorkRow>(client, WORK_TABLE),
    ]);
    workRows = work;
    bookingDates = new Map(bookings.map((row) => [row.id, row.date] as const));
    planned = planBackfill(bookings, tracked, todayKey);
  } catch (error) {
    const message = errorText(error, "Gagal merencanakan sinkronisasi Google.");
    await setConnectionError(client, message, now);
    return { ok: false, results: [], backfilled: 0, failed: 0, error: message };
  }

  let backfilled = 0;
  for (const item of planned) {
    const open = workRows.find(
      (row) => row.booking_id === item.bookingId && row.processed_at === null,
    );
    if (open?.operation === "upsert") continue;
    try {
      await enqueueMirrorWork(client, item.bookingId, "upsert");
      backfilled += 1;
    } catch (error) {
      const message = errorText(error, "Gagal menjadwalkan backfill Google.");
      await setConnectionError(client, message, now);
      return { ok: false, results: [], backfilled, failed: 0, error: message };
    }
  }

  let due: GoogleCalendarWorkRow[];
  try {
    due = (await listRows<GoogleCalendarWorkRow>(client, WORK_TABLE)).filter(
      (row) => {
        if (row.processed_at !== null) return false;
        if (Date.parse(row.next_attempt_at) > now.getTime() + DUE_GRACE_MS) {
          return false;
        }
        if (!options.onlyTodayForward) return true;
        const date = bookingDates.get(row.booking_id);
        // No Booking date means a hard-deleted orphan; removing its event is
        // the whole point, so it stays in scope.
        return date === undefined || date >= todayKey;
      },
    );
  } catch (error) {
    const message = errorText(error, "Gagal memuat antrean Google.");
    await setConnectionError(client, message, now);
    return { ok: false, results: [], backfilled, failed: 0, error: message };
  }

  const results: MirrorWorkResult[] = [];
  for (const row of due) {
    let claimed: GoogleCalendarWorkRow | null;
    try {
      claimed = await claimWork(client, row.booking_id);
    } catch (error) {
      results.push({
        bookingId: row.booking_id,
        operation: row.operation,
        outcome: "failed",
        error: errorText(error, "Gagal mengunci antrean Google."),
      });
      continue;
    }
    if (!claimed) continue; // another drain owns this Booking

    // Work from the claimed snapshot, not the pre-claim row: a Booking save
    // may have coalesced a newer intent into it between the two reads.
    const operation = claimed.operation;
    const attemptCount = claimed.attempt_count;

    try {
      // Re-read after the claim: the first drain may already have stored an id.
      const tracked = await getTrackedEvent(client, row.booking_id);
      const done = await runWork(
        client,
        port,
        config.calendarId,
        row.booking_id,
        operation,
        tracked,
        now,
        adoptOwned,
      );
      const superseded = await hasNewerIntent(
        client,
        row.booking_id,
        claimed,
        operation,
      );
      try {
        await updateWork(client, row.booking_id, {
          // A save that coalesced into this row while Google was working
          // must survive as an open intent; marking it processed would drop
          // the edit or the delete.
          processed_at: superseded ? null : now.toISOString(),
          locked_at: null,
          last_error: "",
          attempt_count: attemptCount + 1,
          next_attempt_at: now.toISOString(),
        });
      } catch {
        // The Google side succeeded; a bookkeeping failure must not turn it
        // into a duplicate-creating retry. The next drain will re-read the
        // tracked row and update it.
      }
      results.push({
        bookingId: row.booking_id,
        operation,
        outcome: done.outcome,
        error: null,
      });
    } catch (error) {
      const message = errorText(error, "Sinkronisasi Google gagal.");
      try {
        await updateWork(client, row.booking_id, {
          processed_at: null,
          locked_at: null,
          last_error: message,
          attempt_count: attemptCount + 1,
          next_attempt_at: new Date(
            now.getTime() + RETRY_DELAY_MS,
          ).toISOString(),
        });
      } catch {
        // Keep the Google error as the visible one; the stale claim expires.
      }
      results.push({
        bookingId: row.booking_id,
        operation,
        outcome: "failed",
        error: message,
      });
    }
  }

  const failed = results.filter((item) => item.outcome === "failed");
  const firstError = failed[0]?.error ?? null;
  try {
    if (firstError) {
      await setConnectionError(client, firstError, now);
    } else if (results.length > 0) {
      await setConnectionError(client, "", now);
    }
  } catch {
    // The drain result already carries the concrete error.
  }

  return {
    ok: failed.length === 0,
    results,
    backfilled,
    failed: failed.length,
    error: firstError,
  };
}

/**
 * Repair the whole today-forward mirror: enqueue the planner's desired state
 * (create missing events, update tracked ones, delete events whose Booking is
 * gone or no longer confirmed), drain those intents with the same retry and
 * error bookkeeping as a Booking save, then remove queue rows left behind by a
 * successful delete.
 *
 * Past Bookings and their tracked rows are outside the plan, so history is
 * never rewritten by a reconcile. Ownership is only the tracked event id: a
 * Google event nobody tracked is not listed for update or deletion.
 */
export async function reconcileMirror(
  client: TypedClient,
  makeRuntime: MirrorRuntimeFactory,
  now: Date = new Date(),
): Promise<MirrorReconcileSummary> {
  // The master switch is checked before any Google port exists. Disconnecting
  // must make a scheduled or manual reconcile a true no-op.
  const connection = await getConnection(client);
  if (!connection.enabled) return emptySummary({ disabled: true });

  let bookings: Booking[];
  let trackedRows: GoogleCalendarEventRow[];
  try {
    [bookings, trackedRows] = await Promise.all([
      listRows<Booking>(client, "bookings"),
      listRows<GoogleCalendarEventRow>(client, EVENTS_TABLE),
    ]);
  } catch (error) {
    const message = errorText(error, "Gagal merencanakan rekonsiliasi Google.");
    await setConnectionError(client, message, now);
    return emptySummary({ ok: false, failed: 1, error: message });
  }

  const planned = planMirrorWork(bookings, trackedRows, mirrorTodayKey(now));

  let enqueueFailed = 0;
  let enqueueError: string | null = null;
  for (const item of planned) {
    try {
      await enqueueMirrorWork(
        client,
        item.bookingId,
        item.action === "delete" ? "delete" : "upsert",
      );
    } catch (error) {
      // One unreadable Booking must not stop the rest of the reconcile.
      enqueueFailed += 1;
      enqueueError ??= errorText(error, "Gagal menjadwalkan rekonsiliasi Google.");
    }
  }

  let drain: MirrorDrainResult;
  try {
    drain = await drainMirrorQueue(client, makeRuntime, now, {
      adoptOwned: false,
      onlyTodayForward: true,
    });
  } catch (error) {
    const message = errorText(error, "Rekonsiliasi Google gagal.");
    try {
      await setConnectionError(client, message, now);
    } catch {
      // The summary still carries the concrete error.
    }
    return emptySummary({
      ok: false,
      failed: enqueueFailed + 1,
      error: enqueueError ?? message,
    });
  }

  // A successful delete is the moment its queue row becomes an orphan. A row
  // that failed stays open and keeps its retry for the next drain.
  let cleanupError: string | null = null;
  try {
    const [freshBookings, freshTracked, freshWork] = await Promise.all([
      listRows<Booking>(client, "bookings"),
      listRows<GoogleCalendarEventRow>(client, EVENTS_TABLE),
      listRows<GoogleCalendarWorkRow>(client, WORK_TABLE),
    ]);
    const bookingById = new Map(
      freshBookings.map((row) => [row.id, row] as const),
    );
    const trackedIds = new Set(freshTracked.map((row) => row.booking_id));
    for (const row of freshWork) {
      if (row.processed_at === null) continue;
      const booking = bookingById.get(row.booking_id);
      const orphaned = !booking && !trackedIds.has(row.booking_id);
      const finishedDelete =
        row.operation === "delete" &&
        (!booking || booking.status !== "confirmed");
      if (orphaned || finishedDelete) {
        await deleteWorkRow(client, row.booking_id);
      }
    }
  } catch (error) {
    cleanupError = errorText(error, "Gagal membersihkan antrean Google.");
  }

  const summary = emptySummary();
  for (const result of drain.results) {
    if (result.outcome === "created") summary.created += 1;
    else if (result.outcome === "updated") summary.updated += 1;
    else if (result.outcome === "deleted") summary.deleted += 1;
    else if (result.outcome === "skipped") summary.skipped += 1;
    else summary.failed += 1;
  }
  summary.failed += enqueueFailed + (cleanupError ? 1 : 0);
  // A drain-level failure (config, unreadable queue, backfill scheduling) has
  // no per-Booking result to count; still show it as one failed reconcile.
  if (drain.error && drain.failed === 0) summary.failed += 1;
  summary.error = enqueueError ?? drain.error ?? cleanupError;
  summary.ok = summary.error === null;

  try {
    await setConnectionError(client, summary.error ?? "", now);
  } catch {
    // The returned summary is still the source of truth for this run.
  }

  return summary;
}
