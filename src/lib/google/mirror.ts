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
  getEnabledConnection,
  setConnectionError,
  type MirrorRuntimeFactory,
} from "./calendar-connection";
import {
  buildMirrorEvent,
  mirrorTodayKey,
  planBackfill,
} from "./mirror-projection";
import type { GoogleCalendarPort } from "./port";
import { enqueueMirrorWork } from "../supabase/admin-mirror";

type TypedClient = SupabaseClient<Database>;

/**
 * The Calendar Mirror adapter (ticket 02).
 *
 * A Booking save only leaves an intent in `google_calendar_work`; this module
 * is what a Node-runtime admin route calls to turn those intents into Google
 * events. The Google port is injected, so every decision — create, update,
 * delete, retry, backfill — is testable without credentials or network.
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

function errorText(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return fallback;
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
): Promise<boolean> {
  if (tracked) {
    await port.deleteEvent(calendarId, tracked.google_event_id);
    await removeTrackedEvent(client, bookingId);
    return true;
  }
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
): Promise<WorkOutcome> {
  if (operation === "delete") {
    const deleted = await deleteMirrorEvent(
      client,
      port,
      calendarId,
      bookingId,
      tracked,
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
    );
    return { outcome: deleted ? "deleted" : "skipped", error: null };
  }

  const serviceName = booking.service_id
    ? await getServiceName(client, booking.service_id)
    : null;
  const draft = buildMirrorEvent(booking, serviceName);

  if (tracked) {
    await port.updateEvent(calendarId, tracked.google_event_id, draft);
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
  // creating a duplicate.
  const owned = await port.listOwnedEvents(calendarId, bookingId);
  if (owned.length > 0) {
    const eventId = owned[0].id;
    await port.updateEvent(calendarId, eventId, draft);
    await storeTrackedEvent(client, bookingId, eventId, now);
    return { outcome: "updated", error: null };
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
): Promise<MirrorDrainResult> {
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
  try {
    const [bookings, tracked, work] = await Promise.all([
      listRows<Booking>(client, "bookings"),
      listRows<GoogleCalendarEventRow>(client, EVENTS_TABLE),
      listRows<GoogleCalendarWorkRow>(client, WORK_TABLE),
    ]);
    workRows = work;
    planned = planBackfill(bookings, tracked, mirrorTodayKey(now));
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
      (row) =>
        row.processed_at === null &&
        Date.parse(row.next_attempt_at) <= now.getTime(),
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
