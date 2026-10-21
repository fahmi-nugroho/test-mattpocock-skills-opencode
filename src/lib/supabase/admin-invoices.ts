import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvoiceDates } from "../admin/invoice";
import { deleteRowById, updateRowById } from "./admin-crud";
import type { Database, Invoice } from "./database";

type TypedClient = SupabaseClient<Database>;

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

interface InvoiceOrders {
  order(
    column: string,
    options: { ascending: boolean },
  ): {
    order(
      column: string,
      options: { ascending: boolean },
    ): Promise<QueryResult>;
  };
}

interface InvoiceSelect extends InvoiceOrders {
  eq(column: string, value: string): InvoiceOrders;
}

export interface CreateInvoiceInput {
  bookingId: string;
  issuedOn: string;
  dueOn: string;
}

/**
 * Issue one Invoice through the `create_invoice` allocation function (0018).
 * The function builds the snapshot from the Booking row itself, so the caller
 * sends only the booking id and both dates. Its refusal messages are already
 * plain Indonesian: pass them through unchanged so the dialog can show them.
 */
export async function createInvoice(
  client: TypedClient,
  input: CreateInvoiceInput,
): Promise<Invoice> {
  const loose = client as unknown as {
    rpc(
      fn: string,
      args: Record<string, unknown>,
    ): Promise<QueryResult>;
  };
  const { data, error } = await loose.rpc("create_invoice", {
    p_booking_id: input.bookingId,
    p_issued_on: input.issuedOn,
    p_due_on: input.dueOn,
  });
  if (error) throw new Error(error.message);
  return data as Invoice;
}

/**
 * Mark an Invoice sent, or take the mark back. `sent_at` is the only stored
 * state: writing the timestamp and clearing it are two explicit admin
 * actions, never a side effect of sharing or opening the picture. 0019
 * freezes every other field once the timestamp is present.
 */
export async function setInvoiceSent(
  client: TypedClient,
  id: string,
  sent: boolean,
): Promise<Invoice> {
  return updateRowById<Invoice>(
    client,
    "invoices",
    id,
    { sent_at: sent ? new Date().toISOString() : null },
    "Gagal memperbarui status kirim invoice",
  );
}

/**
 * Correct the two dates of an unsent Invoice. The issue date's year and
 * `due_on >= issued_on` are checked by the table (0018) and the freeze trigger
 * (0019), so an invalid write is refused rather than silently renumbered.
 */
export async function updateInvoiceDates(
  client: TypedClient,
  id: string,
  dates: InvoiceDates,
): Promise<Invoice> {
  return updateRowById<Invoice>(
    client,
    "invoices",
    id,
    { issued_on: dates.issuedOn, due_on: dates.dueOn },
    "Gagal memperbarui tanggal invoice",
  );
}

/**
 * Delete a mistaken Invoice. 0019 refuses the delete while it is marked sent,
 * so a document the client already received cannot leave the history; unmark
 * it first. Deleting the newest unsent row frees its sequence because
 * `create_invoice` allocates `max(seq) + 1` (0018).
 */
export async function deleteInvoice(
  client: TypedClient,
  id: string,
): Promise<void> {
  await deleteRowById(client, "invoices", id, "Gagal menghapus invoice");
}

async function listInvoices(
  client: TypedClient,
  bookingId?: string,
): Promise<Invoice[]> {
  const loose = client as unknown as {
    from(table: string): {
      select(columns: string): InvoiceSelect;
    };
  };
  const select = loose.from("invoices").select("*");
  const query = bookingId ? select.eq("booking_id", bookingId) : select;
  const { data, error } = await query
    .order("year", { ascending: false })
    .order("seq", { ascending: false });
  if (error) throw new Error(`Failed to load invoices: ${error.message}`);
  return Array.isArray(data) ? (data as Invoice[]) : [];
}

/**
 * Invoices newest first. No booking id returns every row — the manager loads
 * those once so each booking row can show its count and newest number without
 * a second trip; passing a booking id narrows the same adapter to that
 * Booking's list.
 */
export function listInvoicesAdmin(
  client: TypedClient,
  bookingId?: string,
): Promise<Invoice[]> {
  return listInvoices(client, bookingId);
}
