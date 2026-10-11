import type { SupabaseClient } from "@supabase/supabase-js";
import { findBlockConflict } from "../admin/booking-conflicts";
import type { ValidatedBlockInput } from "../admin/validate-block";
import type { Block, Database } from "./database";
import { deleteRowById, insertRow, updateRowById } from "./admin-crud";

type TypedClient = SupabaseClient<Database>;

export type BlockInsert = ValidatedBlockInput;
export type BlockPatch = Partial<ValidatedBlockInput>;

interface BookingRow {
  date: string;
  start_time: string;
  end_time: string;
  status: string;
}

async function listConfirmedBookingsForDate(
  client: TypedClient,
  date: string,
): Promise<BookingRow[]> {
  const loose = client as unknown as {
    from(t: string): {
      select(c: string): {
        eq(c: string, v: string): Promise<{
          data: unknown;
          error: { message: string } | null;
        }>;
      };
    };
  };
  const { data, error } = await loose
    .from("bookings")
    .select("date,start_time,end_time,status")
    .eq("date", date);
  if (error) throw new Error(`Failed to check bookings: ${error.message}`);
  return Array.isArray(data) ? (data as BookingRow[]) : [];
}

async function getBlockById(client: TypedClient, id: string): Promise<Block> {
  const loose = client as unknown as {
    from(t: string): {
      select(c: string): {
        eq(c: string, v: string): {
          single(): Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    };
  };
  const { data, error } = await loose
    .from("blocks")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(`Failed to load block: ${error.message}`);
  return data as Block;
}

/**
 * Admin block list (ticket 07): every row ordered by date then start
 * time. Raw blocks stay anon-denied (0002_rls.sql); call with an
 * authenticated browser client (`blocks_admin_all`).
 */
export async function listBlocksAdmin(client: TypedClient): Promise<Block[]> {
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
    .from("blocks")
    .select("*")
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw new Error(`Failed to load blocks: ${error.message}`);
  return Array.isArray(data) ? (data as Block[]) : [];
}

/**
 * Admin block create (ticket 07). A block must not cover a confirmed
 * booking on its date (pending/cancelled may stay — they do not occupy
 * the public calendar) — rejected with an Indonesian message.
 */
export async function createBlock(
  client: TypedClient,
  input: BlockInsert,
): Promise<Block> {
  const bookings = await listConfirmedBookingsForDate(client, input.date);
  const conflict = findBlockConflict(input, bookings);
  if (conflict) throw new Error(conflict);
  return insertRow<Block>(client, "blocks", input, "Failed to create block");
}

/**
 * Admin block update (ticket 07): merges the patch over the stored row
 * (so an all_day toggle re-checks times correctly), re-runs the
 * confirmed-booking guard, then patches by id.
 */
export async function updateBlock(
  client: TypedClient,
  id: string,
  patch: BlockPatch,
): Promise<Block> {
  const current = await getBlockById(client, id);
  const merged = { ...current, ...patch, id };
  // Toggling to all-day drops times (same rule as validateBlockInput +
  // the SQL CHECK); toggling back without times is a caller error.
  if (merged.all_day) {
    merged.start_time = null;
    merged.end_time = null;
  }
  const bookings = await listConfirmedBookingsForDate(client, merged.date);
  const conflict = findBlockConflict(merged, bookings);
  if (conflict) throw new Error(conflict);
  const payload = merged.all_day
    ? { ...patch, all_day: true, start_time: null, end_time: null }
    : patch;
  return updateRowById<Block>(
    client,
    "blocks",
    id,
    payload,
    "Failed to update block",
  );
}

/**
 * Admin block delete (ticket 07): hard delete by id; the public
 * calendar re-derives on next RPC read.
 */
export async function deleteBlock(
  client: TypedClient,
  id: string,
): Promise<void> {
  await deleteRowById(client, "blocks", id, "Failed to delete block");
}
