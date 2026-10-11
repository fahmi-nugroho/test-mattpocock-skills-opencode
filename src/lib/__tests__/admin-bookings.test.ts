import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createBooking,
  deleteBooking,
  listBookingsAdmin,
  setBookingStatus,
  updateBooking,
} from "../supabase/admin-bookings";
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

// Seam 2 (adapter): admin booking CRUD + overlap guard with injected client.
// Catches wrong table/payload and missing guard wiring.
// Misses live RLS behavior.
function bookingClient(opts: {
  bookingRow?: unknown;
  sameDayBookings?: unknown[];
  sameDayBlocks?: unknown[];
  fullDates?: string[];
  inserted?: unknown;
  updated?: unknown;
  calls?: Array<[string, ...unknown[]]>;
}) {
  const calls = opts.calls ?? [];
  const client = {
    from: (table: string) => {
      calls.push(["from", table]);
      if (table === "settings") {
        return {
          select: (cols: string) => {
            calls.push(["settings.select", cols]);
            return {
              eq: () => ({
                single: async () => ok({ full_dates: opts.fullDates ?? [] }),
              }),
            };
          },
          update: (values: unknown) => {
            calls.push(["settings.update", values]);
            return { eq: async () => ok(null) };
          },
        };
      }
      return {
        select: (cols: string) => {
          calls.push([`${table}.select`, cols]);
          const chain: Record<string, unknown> = {};
          chain.eq = (col: string, val: unknown) => {
            calls.push([`${table}.eq`, col, val]);
            if (col === "id") {
              return { single: async () => ok(opts.bookingRow) };
            }
            return Promise.resolve(
              ok(table === "bookings" ? (opts.sameDayBookings ?? []) : []),
            );
          };
          chain.order = (col: string, o: unknown) => {
            calls.push([`${table}.order`, col, o]);
            return Promise.resolve(ok(opts.sameDayBookings ?? []));
          };
          return chain;
        },
        insert: (values: unknown) => {
          calls.push(["insert", values]);
          return {
            select: () => ({
              single: async () => ok(opts.inserted ?? values),
            }),
          };
        },
        update: (values: unknown) => {
          calls.push(["update", values]);
          return {
            eq: () => ({
              select: () => ({
                single: async () => ok(opts.updated ?? values),
              }),
            }),
          };
        },
        delete: () => ({
          eq: (col: string, val: unknown) => {
            calls.push(["delete.eq", col, val]);
            return Promise.resolve(ok(null));
          },
        }),
      };
    },
  };
  // Blocks sibling reads resolve via the same from() switch: table blocks
  // returns sameDayBlocks. Patch the blocks branch above by wrapping:
  const origFrom = (client as { from(t: string): unknown }).from.bind(client);
  (client as { from(t: string): unknown }).from = (table: string) => {
    const built = origFrom(table) as {
      select(c: string): Record<string, unknown>;
    };
    if (table === "blocks") {
      const origSelect = built.select.bind(built);
      built.select = (cols: string) => {
        const chain = origSelect(cols) as Record<string, unknown>;
        const origEq = chain.eq as (c: string, v: unknown) => unknown;
        chain.eq = (col: string, val: unknown) => {
          calls.push(["blocks.eq", col, val]);
          return Promise.resolve(ok(opts.sameDayBlocks ?? []));
        };
        void origEq;
        return chain;
      };
    }
    return built;
  };
  return { client: asClient(client), calls };
}

const BOOKING = {
  date: "2026-10-12",
  start_time: "09:00",
  end_time: "10:00",
  service_id: null as string | null,
  client_name: "Sinta",
  client_phone: "081234567890",
  notes: "",
  status: "confirmed" as const,
};

describe("listBookingsAdmin", () => {
  it("lists bookings ordered by date then start time", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const rows = [{ ...BOOKING, id: "1" }];
    const client = {
      from: (table: string) => {
        calls.push(["from", table]);
        return {
          select: (cols: string) => {
            calls.push(["select", cols]);
            return {
              order: (col: string, o: unknown) => {
                calls.push(["order1", col, o]);
                return {
                  order: (col2: string, o2: unknown) => {
                    calls.push(["order2", col2, o2]);
                    return Promise.resolve(ok(rows));
                  },
                };
              },
            };
          },
        };
      },
    };
    await expect(listBookingsAdmin(asClient(client))).resolves.toEqual(rows);
    expect(calls).toContainEqual(["from", "bookings"]);
    expect(calls).toContainEqual(["order1", "date", { ascending: true }]);
    expect(calls).toContainEqual([
      "order2",
      "start_time",
      { ascending: true },
    ]);
  });

  it("throws instead of rendering a stale list on error", async () => {
    const client = {
      from: () => ({
        select: () => ({
          order: () => ({ order: async () => fail("db down") }),
        }),
      }),
    };
    await expect(listBookingsAdmin(asClient(client))).rejects.toThrow(
      /db down/,
    );
  });
});

describe("createBooking", () => {
  it("inserts a confirmed booking when the day is free", async () => {
    const { client, calls } = bookingClient({ inserted: { ...BOOKING, id: "9" } });
    await expect(createBooking(client, BOOKING)).resolves.toMatchObject({
      id: "9",
    });
    expect(calls).toContainEqual(["from", "bookings"]);
    expect(calls).toContainEqual([
      "insert",
      expect.objectContaining({ date: "2026-10-12" }),
    ]);
  });

  it("rejects a double-booking with a message instead of inserting", async () => {
    const { client } = bookingClient({
      sameDayBookings: [
        {
          id: "other",
          date: "2026-10-12",
          start_time: "09:30",
          end_time: "10:30",
          status: "confirmed",
        },
      ],
    });
    await expect(createBooking(client, BOOKING)).rejects.toThrow(/bentrok/i);
  });

  it("rejects a confirmed booking on a full-toggle date", async () => {
    const { client } = bookingClient({ fullDates: ["2026-10-12"] });
    await expect(createBooking(client, BOOKING)).rejects.toThrow(/penuh/i);
  });

  it("allows a pending booking to overlap so WA negotiation stays recordable", async () => {
    const { client, calls } = bookingClient({
      sameDayBookings: [
        {
          id: "other",
          date: "2026-10-12",
          start_time: "09:30",
          end_time: "10:30",
          status: "confirmed",
        },
      ],
      inserted: { id: "10" },
    });
    await expect(
      createBooking(client, { ...BOOKING, status: "pending" as const }),
    ).resolves.toMatchObject({ id: "10" });
    expect(calls).toContainEqual(["from", "bookings"]);
  });
});

describe("updateBooking", () => {
  it("reschedules through the same overlap guard", async () => {
    const { client } = bookingClient({
      bookingRow: { ...BOOKING, id: "b1", status: "pending" },
      sameDayBookings: [
        {
          id: "other",
          date: "2026-10-13",
          start_time: "09:30",
          end_time: "10:30",
          status: "confirmed",
        },
      ],
      updated: { id: "b1" },
    });
    await expect(
      updateBooking(client, "b1", {
        date: "2026-10-13",
        start_time: "09:00",
        end_time: "10:00",
        status: "confirmed",
      }),
    ).rejects.toThrow(/bentrok/i);
  });
});

describe("setBookingStatus", () => {
  it("confirming runs the guard so public day-status stays correct", async () => {
    const { client } = bookingClient({
      bookingRow: { ...BOOKING, id: "b1", status: "pending" },
      sameDayBookings: [
        {
          id: "other",
          date: "2026-10-12",
          start_time: "09:30",
          end_time: "10:30",
          status: "confirmed",
        },
      ],
    });
    await expect(setBookingStatus(client, "b1", "confirmed")).rejects.toThrow(
      /bentrok/i,
    );
  });

  it("cancelling skips the guard and updates the row", async () => {
    const { client, calls } = bookingClient({
      bookingRow: { ...BOOKING, id: "b1", status: "confirmed" },
      updated: { id: "b1", status: "cancelled" },
    });
    await expect(
      setBookingStatus(client, "b1", "cancelled"),
    ).resolves.toMatchObject({ status: "cancelled" });
    expect(calls).toContainEqual(["from", "bookings"]);
  });
});

describe("deleteBooking", () => {
  it("deletes by id", async () => {
    const { client, calls } = bookingClient({});
    await expect(deleteBooking(client, "b1")).resolves.toBeUndefined();
    expect(calls).toContainEqual(["delete.eq", "id", "b1"]);
  });
});
