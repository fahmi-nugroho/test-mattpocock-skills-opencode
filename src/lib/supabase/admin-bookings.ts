import type { SupabaseClient } from "@supabase/supabase-js";
import { findBookingConflict } from "../admin/booking-conflicts";
import type { ValidatedBookingInput } from "../admin/validate-booking";
import type {
  Booking,
  BookingStatus,
  Database,
  GoogleCalendarOperation,
} from "./database";
import { deleteRowById, insertRow, updateRowById } from "./admin-crud";
import { enqueueMirrorWork } from "./admin-mirror";

type TypedClient = SupabaseClient<Database>;

/**
 * Leave one Calendar Mirror intent behind after a successful write. A queue
 * failure must never turn a saved Booking into an error: the next drain or
 * the daily reconcile repairs it, so the local save always wins.
 */
async function queueMirror(
  client: TypedClient,
  bookingId: string,
  operation: GoogleCalendarOperation,
): Promise<void> {
  try {
    await enqueueMirrorWork(client, bookingId, operation);
  } catch {
    // Deliberately swallowed; Google never blocks a Booking write.
  }
}

function mirrorOperation(status: BookingStatus): GoogleCalendarOperation {
  return status === "confirmed" ? "upsert" : "delete";
}

export type BookingInsert = ValidatedBookingInput;
export type BookingPatch = Partial<ValidatedBookingInput>;

interface DateRow {
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  id?: string;
}

interface BlockRow {
  date: string;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  id?: string;
}

/** Loose query surface: the typed client generics cannot express the
 *  small per-table chains without leaking table specifics. */
interface QueryChain {
  eq(c: string, v: string): Promise<{ data: unknown; error: { message: string } | null }> | { single(): Promise<{ data: unknown; error: { message: string } | null }> };
  order(
    c: string,
    o: { ascending: boolean },
  ): unknown;
}

function tableQuery(client: TypedClient, table: string) {
  return (client as unknown as {
    from(t: string): {
      select(c: string): QueryChain;
      insert(v: unknown): {
        select(): {
          single(): Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
      update(v: unknown): {
        eq(c: string, v: string): {
          select(): {
            single(): Promise<{ data: unknown; error: { message: string } | null }>;
          };
        };
      };
      delete(): {
        eq(c: string, v: string): Promise<{ error: { message: string } | null }>;
      };
    };
  }).from(table);
}

async function listBookingsForDate(
  client: TypedClient,
  date: string,
): Promise<DateRow[]> {
  const q = tableQuery(client, "bookings").select("*").eq("date", date);
  const { data, error } = await (q as Promise<{
    data: unknown;
    error: { message: string } | null;
  }>);
  if (error) throw new Error(`Failed to check bookings: ${error.message}`);
  return Array.isArray(data) ? (data as DateRow[]) : [];
}

async function listBlocksForDate(
  client: TypedClient,
  date: string,
): Promise<BlockRow[]> {
  const q = tableQuery(client, "blocks").select("*").eq("date", date);
  const { data, error } = await (q as Promise<{
    data: unknown;
    error: { message: string } | null;
  }>);
  if (error) throw new Error(`Failed to check blocks: ${error.message}`);
  return Array.isArray(data) ? (data as BlockRow[]) : [];
}

async function getFullDatesForGuard(client: TypedClient): Promise<string[]> {
  const loose = client as unknown as {
    from(t: string): {
      select(c: string): {
        eq(c: string, v: number): {
          single(): Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    };
  };
  const { data, error } = await loose
    .from("settings")
    .select("full_dates")
    .eq("id", 1)
    .single();
  if (error) throw new Error(`Failed to check full dates: ${error.message}`);
  const dates = (data as { full_dates?: unknown } | null)?.full_dates;
  return Array.isArray(dates) ? (dates as string[]) : [];
}

async function getBookingById(
  client: TypedClient,
  id: string,
): Promise<Booking> {
  const q = tableQuery(client, "bookings").select("*").eq("id", id);
  const { data, error } = await (
    q as {
      single(): Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).single();
  if (error) throw new Error(`Failed to load booking: ${error.message}`);
  return data as Booking;
}

/**
 * Admin booking list (ticket 07): every row ordered by date then start
 * time, all statuses included — the raw table stays anon-denied
 * (0002_rls.sql), so call with an authenticated browser client.
 */
export async function listBookingsAdmin(
  client: TypedClient,
): Promise<Booking[]> {
  const loose = client as unknown as {
    from(t: string): {
      select(c: string): {
        order(c: string, o: { ascending: boolean }): {
          order(c: string, o: { ascending: boolean }): Promise<{
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
    .order("date", { ascending: true })
    .order("start_time", {
      ascending: true,
    });
  if (error) throw new Error(`Failed to load bookings: ${error.message}`);
  return Array.isArray(data) ? (data as Booking[]) : [];
}

/**
 * Admin booking create (ticket 07). Enforces the doesOverlap guard
 * before insert: a confirmed booking must not overlap another
 * confirmed booking or any block on its date, nor land on a manual
 * full-toggle date — rejected with an Indonesian message so the admin
 * knows why the double-booking was refused. Pending rows skip the
 * guard so WA negotiation stays recordable.
 */
export async function createBooking(
  client: TypedClient,
  input: BookingInsert,
): Promise<Booking> {
  const [bookings, blocks, fullDates] = await Promise.all([
    listBookingsForDate(client, input.date),
    listBlocksForDate(client, input.date),
    getFullDatesForGuard(client),
  ]);
  const conflict = findBookingConflict(input, bookings, blocks, fullDates);
  if (conflict) throw new Error(conflict);
  const row = await insertRow<Booking>(
    client,
    "bookings",
    input,
    "Failed to create booking",
  );
  await queueMirror(
    client,
    row.id,
    mirrorOperation(row.status ?? input.status),
  );
  return row;
}

/**
 * Admin booking update / reschedule (ticket 07): merges the patch over
 * the stored row, re-runs the same overlap guard (excluding self so a
 * no-change save never self-conflicts), then patches by id.
 */
export async function updateBooking(
  client: TypedClient,
  id: string,
  patch: BookingPatch,
): Promise<Booking> {
  const current = await getBookingById(client, id);
  const merged = { ...current, ...patch, id };
  const [bookings, blocks, fullDates] = await Promise.all([
    listBookingsForDate(client, merged.date),
    listBlocksForDate(client, merged.date),
    getFullDatesForGuard(client),
  ]);
  const conflict = findBookingConflict(merged, bookings, blocks, fullDates);
  if (conflict) throw new Error(conflict);
  const row = await updateRowById<Booking>(
    client,
    "bookings",
    id,
    patch,
    "Failed to update booking",
  );
  await queueMirror(
    client,
    id,
    mirrorOperation(row.status ?? merged.status),
  );
  return row;
}

/**
 * Confirm / cancel / re-pending a booking (ticket 07). Confirming runs
 * the overlap guard (public day-status derives from confirmed rows via
 * the month RPC, so a conflicting confirm must be refused); cancelling
 * or re-pending skips it and writes straight through.
 */
export async function setBookingStatus(
  client: TypedClient,
  id: string,
  status: BookingStatus,
): Promise<Booking> {
  const current = await getBookingById(client, id);
  if (status === "confirmed") {
    const [bookings, blocks, fullDates] = await Promise.all([
      listBookingsForDate(client, current.date),
      listBlocksForDate(client, current.date),
      getFullDatesForGuard(client),
    ]);
    const conflict = findBookingConflict(
      { ...current, status, id },
      bookings,
      blocks,
      fullDates,
    );
    if (conflict) throw new Error(conflict);
  }
  const row = await updateRowById<Booking>(
    client,
    "bookings",
    id,
    { status },
    "Failed to update booking status",
  );
  await queueMirror(client, id, mirrorOperation(row.status ?? status));
  return row;
}

/**
 * Admin booking delete (ticket 07): hard delete by id. The public
 * calendar re-derives on next RPC read, so a removed confirmed booking
 * frees the day without extra wiring.
 */
export async function deleteBooking(
  client: TypedClient,
  id: string,
): Promise<void> {
  await deleteRowById(client, "bookings", id, "Failed to delete booking");
  // The queue row deliberately has no foreign key to the Booking, so this
  // intent survives the row that just disappeared and can still delete the
  // Google event.
  await queueMirror(client, id, "delete");
}
