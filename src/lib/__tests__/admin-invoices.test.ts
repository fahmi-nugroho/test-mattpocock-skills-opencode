import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createInvoice,
  deleteInvoice,
  listInvoicesAdmin,
  setInvoiceSent,
  updateInvoiceDates,
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

function updateClient(
  opts: {
    row?: Invoice;
    error?: string;
    calls?: Array<[string, ...unknown[]]>;
  } = {},
) {
  const calls = opts.calls ?? [];
  const client = {
    from: (table: string) => {
      calls.push(["from", table]);
      return {
        update: (patch: unknown) => {
          calls.push([`${table}.update`, patch]);
          return {
            eq: (col: string, val: unknown) => {
              calls.push([`${table}.eq`, col, val]);
              return {
                select: () => {
                  calls.push([`${table}.select`]);
                  return {
                    single: async () => {
                      calls.push([`${table}.single`]);
                      return opts.error
                        ? fail(opts.error)
                        : ok(opts.row ?? ROW);
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  return { client: asClient(client), calls };
}

describe("setInvoiceSent", () => {
  it("writes a sent timestamp when the admin marks an Invoice sent", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const before = Date.now();
    const { client } = updateClient({ calls });

    await expect(setInvoiceSent(client, "i1", true)).resolves.toEqual(ROW);

    const patch = calls.find(([name]) => name === "invoices.update")?.[1] as {
      sent_at: string | null;
    };
    expect(Object.keys(patch)).toEqual(["sent_at"]);
    expect(patch.sent_at).not.toBeNull();
    expect(new Date(patch.sent_at as string).getTime()).toBeGreaterThanOrEqual(
      before,
    );
    expect(calls).toContainEqual(["invoices.eq", "id", "i1"]);
    expect(calls).toContainEqual(["from", "invoices"]);
  });

  it("clears the sent timestamp when the admin unmarks it", async () => {
    const { client, calls } = updateClient({
      row: { ...ROW, sent_at: null },
    });
    await expect(setInvoiceSent(client, "i1", false)).resolves.toEqual({
      ...ROW,
      sent_at: null,
    });
    expect(calls).toContainEqual(["invoices.update", { sent_at: null }]);
  });

  it("surfaces a refusal unchanged instead of pretending it was marked", async () => {
    const { client } = updateClient({ error: "Invoice tidak ditemukan." });
    await expect(setInvoiceSent(client, "i1", true)).rejects.toThrow(
      /tidak ditemukan/i,
    );
  });
});

describe("updateInvoiceDates", () => {
  it("writes both dates through the invoices table", async () => {
    const { client, calls } = updateClient({
      row: { ...ROW, issued_on: "2026-10-21", due_on: "2026-11-01" },
    });
    await expect(
      updateInvoiceDates(client, "i1", {
        issuedOn: "2026-10-21",
        dueOn: "2026-11-01",
      }),
    ).resolves.toEqual({
      ...ROW,
      issued_on: "2026-10-21",
      due_on: "2026-11-01",
    });
    expect(calls).toContainEqual(["from", "invoices"]);
    expect(calls).toContainEqual([
      "invoices.update",
      { issued_on: "2026-10-21", due_on: "2026-11-01" },
    ]);
    expect(calls).toContainEqual(["invoices.eq", "id", "i1"]);
  });

  it("surfaces the database's date refusal unchanged", async () => {
    const { client } = updateClient({
      error: "Tanggal terbit harus tetap di tahun 2026.",
    });
    await expect(
      updateInvoiceDates(client, "i1", {
        issuedOn: "2027-01-01",
        dueOn: "2027-01-02",
      }),
    ).rejects.toThrow(/tahun 2026/i);
  });
});

describe("deleteInvoice", () => {
  it("deletes the Invoice row by id", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const client = {
      from: (table: string) => {
        calls.push(["from", table]);
        return {
          delete: () => {
            calls.push([`${table}.delete`]);
            return {
              eq: async (col: string, val: unknown) => {
                calls.push([`${table}.eq`, col, val]);
                return ok(null);
              },
            };
          },
        };
      },
    };

    await expect(deleteInvoice(asClient(client), "i1")).resolves.toBeUndefined();
    expect(calls).toContainEqual(["from", "invoices"]);
    expect(calls).toContainEqual(["invoices.delete"]);
    expect(calls).toContainEqual(["invoices.eq", "id", "i1"]);
  });

  it("surfaces a refusal unchanged", async () => {
    const client = {
      from: () => ({
        delete: () => ({
          eq: async () => fail("Invoice yang sudah dikirim tidak dapat dihapus."),
        }),
      }),
    };
    await expect(deleteInvoice(asClient(client), "i1")).rejects.toThrow(
      /tidak dapat dihapus/i,
    );
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
