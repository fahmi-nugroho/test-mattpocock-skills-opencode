import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createInvoice,
  listInvoicesAdmin,
} from "../supabase/admin-invoices";
import type { Database, Invoice } from "../supabase/database";

type TypedClient = SupabaseClient<Database>;
const asClient = (client: unknown): TypedClient =>
  client as unknown as TypedClient;

function ok(data: unknown) {
  return { data, error: null };
}
function fail(message: string) {
  return { data: null, error: { message } };
}

const ROW: Invoice = {
  id: "i1",
  created_at: "2026-10-20T08:00:00.000Z",
  booking_id: "b1",
  year: 2026,
  seq: 7,
  number: "invc-07/2026",
  issued_on: "2026-10-20",
  due_on: "2026-11-14",
  sent_at: null,
  client_name: "Sari",
  client_phone: "081234567890",
  service_name: "Makeup Wisuda",
  event_type: "Wisuda",
  headcount: 2,
  venue: "Gedung A",
  hairdo: "hijabdo",
  booking_date: "2026-11-14",
  start_time: "08:00",
  end_time: "12:00",
  subtotal: 1_500_000,
  dp_amount: 500_000,
};

// Seam 2 (adapter): the Invoice table and the allocation function with an
// injected client. Catches a wrong RPC/table/order/payload and an adapter that
// buries the database's plain Indonesian refusal under an English label.
// Misses live RLS and the advisory-lock race (0018).
describe("createInvoice", () => {
  it("calls the allocation function with the Booking and both dates", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const client = {
      rpc: async (fn: string, args: unknown) => {
        calls.push(["rpc", fn, args]);
        return ok(ROW);
      },
    };

    await expect(
      createInvoice(asClient(client), {
        bookingId: "b1",
        issuedOn: "2026-10-20",
        dueOn: "2026-11-14",
      }),
    ).resolves.toEqual(ROW);

    expect(calls).toContainEqual([
      "rpc",
      "create_invoice",
      {
        p_booking_id: "b1",
        p_issued_on: "2026-10-20",
        p_due_on: "2026-11-14",
      },
    ]);
  });

  it("surfaces the database's Indonesian refusal unchanged", async () => {
    const client = {
      rpc: async () => fail("Invoice tidak dapat dibuat untuk booking yang dibatalkan."),
    };
    await expect(
      createInvoice(asClient(client), {
        bookingId: "b1",
        issuedOn: "2026-10-20",
        dueOn: "2026-11-14",
      }),
    ).rejects.toThrow(/dibatalkan/i);
  });
});

function listClient(
  opts: {
    rows?: unknown[];
    error?: string;
    calls?: Array<[string, ...unknown[]]>;
  } = {},
) {
  const calls = opts.calls ?? [];
  const client = {
    from: (table: string) => {
      calls.push(["from", table]);
      return {
        select: (cols: string) => {
          calls.push([`${table}.select`, cols]);
          const chain: Record<string, unknown> = {};
          chain.eq = (col: string, val: unknown) => {
            calls.push([`${table}.eq`, col, val]);
            return chain;
          };
          chain.order = (col: string, direction: unknown) => {
            calls.push([`${table}.order`, col, direction]);
            // The first order returns the chain; the second settles the query.
            const next = (c: string, d: unknown) => {
              calls.push([`${table}.order`, c, d]);
              return Promise.resolve(
                opts.error ? fail(opts.error) : ok(opts.rows ?? []),
              );
            };
            return { order: next };
          };
          return chain;
        },
      };
    },
  };
  return { client: asClient(client), calls };
}

describe("listInvoicesAdmin", () => {
  it("lists every Invoice newest first by year then sequence", async () => {
    const { client, calls } = listClient({ rows: [ROW] });
    await expect(listInvoicesAdmin(client)).resolves.toEqual([ROW]);
    expect(calls).toContainEqual(["from", "invoices"]);
    expect(calls).toContainEqual(["invoices.select", "*"]);
    expect(calls).toContainEqual([
      "invoices.order",
      "year",
      { ascending: false },
    ]);
    expect(calls).toContainEqual([
      "invoices.order",
      "seq",
      { ascending: false },
    ]);
  });

  it("throws instead of rendering a stale list on error", async () => {
    const { client } = listClient({ error: "db down" });
    await expect(listInvoicesAdmin(client)).rejects.toThrow(/db down/);
  });
});

describe("listInvoicesAdmin for one Booking", () => {
  it("narrows the newest-first list to one Booking", async () => {
    const { client, calls } = listClient({ rows: [ROW] });
    await expect(listInvoicesAdmin(client, "b1")).resolves.toEqual([ROW]);
    expect(calls).toContainEqual(["invoices.eq", "booking_id", "b1"]);
    expect(calls).toContainEqual([
      "invoices.order",
      "year",
      { ascending: false },
    ]);
    expect(calls).toContainEqual([
      "invoices.order",
      "seq",
      { ascending: false },
    ]);
  });
});
