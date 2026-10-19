import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  correctBookingRequest,
  createBookingRequest,
  deleteBookingRequest,
  linkBookingRequest,
  listBookingRequestsAdmin,
} from "../supabase/admin-requests";
import type { Database } from "../supabase/database";

type TypedClient = SupabaseClient<Database>;
const asClient = (client: unknown): TypedClient =>
  client as unknown as TypedClient;

function ok(data: unknown) {
  return { data, error: null };
}
function fail(message: string) {
  return { data: null, error: { message } };
}

// Seam 2 (adapter): admin Booking Request list/create/link with an injected
// client. Catches wrong table/payload, a missing acceptance guard, and an
// English/absent refusal message. Misses live RLS + the FK's on-delete-set-null.
function requestClient(opts: {
  listRows?: unknown[];
  listError?: string;
  inserted?: unknown;
  insertError?: string;
  // Both guarded update adapters (link, correct) share one terminal, so one
  // pair of knobs serves both.
  updateRows?: unknown[];
  updateError?: string;
  deletedRows?: unknown[];
  deleteError?: string;
  current?: unknown;
  currentError?: string;
  calls?: Array<[string, ...unknown[]]>;
}) {
  const calls = opts.calls ?? [];
  const client = {
    from: (table: string) => {
      calls.push(["from", table]);
      return {
        select: (cols: string) => {
          calls.push([`${table}.select`, cols]);
          const chain: Record<string, unknown> = {};
          chain.order = (col: string, o: unknown) => {
            calls.push([`${table}.order`, col, o]);
            return Promise.resolve(
              opts.listError ? fail(opts.listError) : ok(opts.listRows ?? []),
            );
          };
          chain.eq = (col: string, val: unknown) => {
            calls.push([`${table}.select.eq`, col, val]);
            return {
              single: async () =>
                opts.currentError
                  ? fail(opts.currentError)
                  : ok(opts.current),
            };
          };
          return chain;
        },
        insert: (values: unknown) => {
          calls.push(["insert", values]);
          return {
            select: () => ({
              single: async () =>
                opts.insertError
                  ? fail(opts.insertError)
                  : ok(opts.inserted ?? values),
            }),
          };
        },
        update: (values: unknown) => {
          calls.push(["update", values]);
          const chain: Record<string, unknown> = {};
          chain.eq = (col: string, val: unknown) => {
            calls.push(["update.eq", col, val]);
            return chain;
          };
          chain.not = (col: string, op: string, val: unknown) => {
            calls.push(["update.not", col, op, val]);
            return chain;
          };
          chain.is = (col: string, val: unknown) => {
            calls.push(["update.is", col, val]);
            return chain;
          };
          chain.gt = (col: string, val: unknown) => {
            calls.push(["update.gt", col, val]);
            return {
              select: async () =>
                opts.updateError
                  ? fail(opts.updateError)
                  : ok(opts.updateRows ?? []),
            };
          };
          return chain;
        },
        delete: () => {
          calls.push(["delete"]);
          const chain: Record<string, unknown> = {};
          chain.eq = (col: string, val: unknown) => {
            calls.push(["delete.eq", col, val]);
            return chain;
          };
          chain.is = (col: string, val: unknown) => {
            calls.push(["delete.is", col, val]);
            return {
              select: async () =>
                opts.deleteError
                  ? fail(opts.deleteError)
                  : ok(opts.deletedRows ?? []),
            };
          };
          return chain;
        },
      };
    },
  };
  return { client: asClient(client), calls };
}

const REQUEST_ROW = {
  id: "req-1",
  token: "tok-1",
  created_at: "2026-10-15T00:00:00.000Z",
  expires_at: "2999-01-01T00:00:00.000Z",
  submitted_at: null,
  accepted_booking_id: null,
  client_name: "",
  client_phone: "",
  event_type: "",
  headcount: 1,
  venue: "",
  hairdo: "",
  reference: "",
  notes: "",
  date: null,
  start_time: null,
  end_time: null,
};

describe("listBookingRequestsAdmin", () => {
  it("lists requests from booking_requests newest first", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const rows = [{ ...REQUEST_ROW, id: "req-1" }];
    const { client } = requestClient({ listRows: rows, calls });
    await expect(listBookingRequestsAdmin(client)).resolves.toEqual(rows);
    expect(calls).toContainEqual(["from", "booking_requests"]);
    expect(calls).toContainEqual([
      "booking_requests.order",
      "created_at",
      { ascending: false },
    ]);
  });

  it("throws instead of rendering a stale list on error", async () => {
    const { client } = requestClient({ listError: "db down" });
    await expect(listBookingRequestsAdmin(client)).rejects.toThrow(/db down/);
  });
});

describe("createBookingRequest", () => {
  it("inserts only the four admin-supplied fields, trimmed", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const { client } = requestClient({ calls });
    await createBookingRequest(client, {
      client_name: "  Sinta  ",
      date: "2026-11-01",
      start_time: "09:00",
      end_time: "11:00",
    });
    expect(calls).toContainEqual(["from", "booking_requests"]);
    expect(calls).toContainEqual([
      "insert",
      {
        client_name: "Sinta",
        date: "2026-11-01",
        start_time: "09:00",
        end_time: "11:00",
      },
    ]);
  });

  it("leaves the slot null when the admin set nothing", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const { client } = requestClient({ calls });
    await createBookingRequest(client, {});
    expect(calls).toContainEqual([
      "insert",
      { client_name: "", date: null, start_time: null, end_time: null },
    ]);
  });

  it("inserts a partial slot as-is, leaving absent fields null", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const { client } = requestClient({ calls });
    await createBookingRequest(client, {
      client_name: "Sinta",
      date: "2026-11-01",
    });
    expect(calls).toContainEqual([
      "insert",
      {
        client_name: "Sinta",
        date: "2026-11-01",
        start_time: null,
        end_time: null,
      },
    ]);
  });

  it("accepts a lone start or end time", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const { client } = requestClient({ calls });
    await createBookingRequest(client, { start_time: "09:00" });
    expect(calls).toContainEqual([
      "insert",
      { client_name: "", date: null, start_time: "09:00", end_time: null },
    ]);
  });

  it("rejects a malformed date, a malformed time, and an inverted range", async () => {
    const { client } = requestClient({});
    await expect(
      createBookingRequest(client, {
        date: "01-11-2026",
        start_time: "09:00",
        end_time: "11:00",
      }),
    ).rejects.toThrow(/tanggal/i);
    await expect(
      createBookingRequest(client, {
        date: "2026-11-01",
        start_time: "9:00",
        end_time: "11:00",
      }),
    ).rejects.toThrow(/jam/i);
    await expect(
      createBookingRequest(client, {
        date: "2026-11-01",
        start_time: "11:00",
        end_time: "09:00",
      }),
    ).rejects.toThrow(/jam mulai/i);
  });
});

describe("linkBookingRequest", () => {
  it("sets accepted_booking_id behind submitted + not-accepted + not-expired guards", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const accepted = {
      ...REQUEST_ROW,
      submitted_at: "2026-10-17T09:00:00.000Z",
      accepted_booking_id: "b-1",
    };
    const { client } = requestClient({ updateRows: [accepted], calls });
    await expect(
      linkBookingRequest(client, "req-1", "b-1"),
    ).resolves.toMatchObject({ accepted_booking_id: "b-1" });
    expect(calls).toContainEqual(["from", "booking_requests"]);
    expect(calls).toContainEqual([
      "update",
      { accepted_booking_id: "b-1" },
    ]);
    expect(calls).toContainEqual(["update.eq", "id", "req-1"]);
    expect(calls).toContainEqual(["update.not", "submitted_at", "is", null]);
    expect(calls).toContainEqual(["update.is", "accepted_booking_id", null]);
    expect(calls).toContainEqual(["update.gt", "expires_at", expect.any(String)]);
  });

  it("refuses an already-accepted request in Indonesian", async () => {
    const current = {
      ...REQUEST_ROW,
      submitted_at: "2026-10-17T09:00:00.000Z",
      accepted_booking_id: "b-9",
    };
    const { client } = requestClient({ updateRows: [], current });
    await expect(linkBookingRequest(client, "req-1", "b-1")).rejects.toThrow(
      /sudah diterima/i,
    );
  });

  it("refuses an expired request in Indonesian", async () => {
    const current = { ...REQUEST_ROW, expires_at: "2020-01-01T00:00:00.000Z" };
    const { client } = requestClient({ updateRows: [], current });
    await expect(linkBookingRequest(client, "req-1", "b-1")).rejects.toThrow(
      /kedaluwarsa/i,
    );
  });

  it("refuses a request the client never submitted", async () => {
    const { client } = requestClient({ updateRows: [], current: REQUEST_ROW });
    await expect(linkBookingRequest(client, "req-1", "b-1")).rejects.toThrow(
      /belum dikirim/i,
    );
  });

  it("translates a unique-violation race into the same refusal", async () => {
    const { client } = requestClient({
      updateError:
        'duplicate key value violates unique constraint "booking_requests_accepted_booking_id_key"',
    });
    await expect(linkBookingRequest(client, "req-1", "b-1")).rejects.toThrow(
      /sudah diterima/i,
    );
  });
});

describe("deleteBookingRequest", () => {
  it("deletes by id behind a not-accepted guard", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const { client } = requestClient({
      deletedRows: [{ ...REQUEST_ROW, id: "req-1" }],
      calls,
    });
    await expect(deleteBookingRequest(client, "req-1")).resolves.toBeUndefined();
    expect(calls).toContainEqual(["from", "booking_requests"]);
    expect(calls).toContainEqual(["delete.eq", "id", "req-1"]);
    expect(calls).toContainEqual(["delete.is", "accepted_booking_id", null]);
  });

  it("refuses an accepted request in Indonesian and points at deleting the Booking", async () => {
    const current = {
      ...REQUEST_ROW,
      submitted_at: "2026-10-17T09:00:00.000Z",
      accepted_booking_id: "b-9",
    };
    const { client } = requestClient({ deletedRows: [], current });
    await expect(deleteBookingRequest(client, "req-1")).rejects.toThrow(
      /hapus booking/i,
    );
  });

  it("explains a lost-race refusal in Indonesian without pretending the row is gone", async () => {
    const { client } = requestClient({ deletedRows: [], current: REQUEST_ROW });
    await expect(deleteBookingRequest(client, "req-1")).rejects.toThrow(
      /muat ulang/i,
    );
  });

  it("surfaces a delete failure instead of pretending the row is gone", async () => {
    const { client } = requestClient({ deleteError: "db down" });
    await expect(deleteBookingRequest(client, "req-1")).rejects.toThrow(
      /gagal menghapus/i,
    );
  });
});

describe("correctBookingRequest", () => {
  it("patches only the admin-owned prefill behind not-answered + not-lapsed + not-accepted guards", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const corrected = {
      ...REQUEST_ROW,
      client_name: "Sinta",
      date: "2026-11-01",
      start_time: "09:00",
      end_time: "11:00",
    };
    const { client } = requestClient({ updateRows: [corrected], calls });
    await expect(
      correctBookingRequest(client, "req-1", {
        client_name: "  Sinta  ",
        date: "2026-11-01",
        start_time: "09:00",
        end_time: "11:00",
      }),
    ).resolves.toMatchObject({ client_name: "Sinta" });
    expect(calls).toContainEqual(["from", "booking_requests"]);
    expect(calls).toContainEqual([
      "update",
      {
        client_name: "Sinta",
        date: "2026-11-01",
        start_time: "09:00",
        end_time: "11:00",
      },
    ]);
    expect(calls).toContainEqual(["update.eq", "id", "req-1"]);
    expect(calls).toContainEqual(["update.is", "submitted_at", null]);
    expect(calls).toContainEqual(["update.is", "accepted_booking_id", null]);
    expect(calls).toContainEqual(["update.gt", "expires_at", expect.any(String)]);
  });

  it("validates the requested slot with the create path's rule before any write", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const { client } = requestClient({ calls });
    await expect(
      correctBookingRequest(client, "req-1", {
        start_time: "11:00",
        end_time: "09:00",
      }),
    ).rejects.toThrow(/jam mulai/i);
    expect(calls.some(([name]) => name === "update")).toBe(false);
  });

  it("refuses correcting a request the client has already answered, in Indonesian", async () => {
    const current = {
      ...REQUEST_ROW,
      submitted_at: "2026-10-17T09:00:00.000Z",
    };
    const { client } = requestClient({ updateRows: [], current });
    await expect(
      correctBookingRequest(client, "req-1", { client_name: "Sinta" }),
    ).rejects.toThrow(/klien sudah mengirim/i);
  });

  it("refuses correcting an accepted request, in Indonesian", async () => {
    const current = {
      ...REQUEST_ROW,
      submitted_at: "2026-10-17T09:00:00.000Z",
      accepted_booking_id: "b-9",
    };
    const { client } = requestClient({ updateRows: [], current });
    await expect(
      correctBookingRequest(client, "req-1", { client_name: "Sinta" }),
    ).rejects.toThrow(/sudah diterima/i);
  });

  it("refuses correcting a lapsed request, in Indonesian", async () => {
    const current = { ...REQUEST_ROW, expires_at: "2020-01-01T00:00:00.000Z" };
    const { client } = requestClient({ updateRows: [], current });
    await expect(
      correctBookingRequest(client, "req-1", { client_name: "Sinta" }),
    ).rejects.toThrow(/kedaluwarsa/i);
  });

  it("explains a lost-race refusal in Indonesian without pretending the row changed", async () => {
    const { client } = requestClient({ updateRows: [], current: REQUEST_ROW });
    await expect(
      correctBookingRequest(client, "req-1", { client_name: "Sinta" }),
    ).rejects.toThrow(/muat ulang/i);
  });

  it("surfaces a write failure instead of pretending the row changed", async () => {
    const { client } = requestClient({ updateError: "db down" });
    await expect(
      correctBookingRequest(client, "req-1", { client_name: "Sinta" }),
    ).rejects.toThrow(/gagal memperbarui/i);
  });
});
