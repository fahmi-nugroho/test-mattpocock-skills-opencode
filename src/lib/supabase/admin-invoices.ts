import type { SupabaseClient } from "@supabase/supabase-js";
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
