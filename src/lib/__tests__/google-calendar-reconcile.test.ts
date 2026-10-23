import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reconcileMirror } from "../google/mirror";
import {
  isCronAuthorized,
  isCronSecretValid,
  readCronSecret,
} from "../google/cron-auth";
import type { GoogleCalendarConfig } from "../google/config";
import type {
  GoogleCalendarEventDraft,
  GoogleCalendarPort,
} from "../google/port";
import type {
  Booking,
  Database,
  GoogleCalendarConnection,
  GoogleCalendarEventRow,
  GoogleCalendarWorkRow,
  Service,
} from "../supabase/database";

type TypedClient = SupabaseClient<Database>;
const asClient = (client: unknown): TypedClient =>
  client as unknown as TypedClient;

const CONFIG: GoogleCalendarConfig = {
  serviceAccountEmail: "mirror@mua.iam.gserviceaccount.com",
  privateKey: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
  calendarId: "mua-booking@group.calendar.google.com",
};

const NOW = new Date("2026-10-22T03:00:00.000Z"); // 10:00 WIB

const CONNECTION: GoogleCalendarConnection = {
  id: 1,
  enabled: true,
  calendar_id: CONFIG.calendarId,
  last_verified_at: "2026-10-21T00:00:00.000Z",
  last_error: "",
  updated_at: "2026-10-21T00:00:00.000Z",
};

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "b1",
    date: "2026-11-01",
    start_time: "09:00",
    end_time: "11:00",
    service_id: "s1",
    client_name: "Sinta",
    client_phone: "081234567890",
    notes: "",
    status: "confirmed",
    event_type: "Wisuda",
    headcount: 1,
    venue: "Bandung",
    hairdo: "hairdo",
    reference: "",
    total_price: 500000,
    dp_amount: 100000,
    ...overrides,
  };
}

const SERVICE: Service = {
  id: "s1",
  name: "Makeup Wisuda",
  description: "",
  price_idr: 500000,
  duration_min: 90,
  active: true,
  cover_image_url: null,
  sort: 0,
};

function tracked(bookingId = "b1", eventId = "g1"): GoogleCalendarEventRow {
  return {
    booking_id: bookingId,
    google_event_id: eventId,
    last_synced_at: "2026-10-21T00:00:00.000Z",
    updated_at: "2026-10-21T00:00:00.000Z",
  };
}

function work(
  overrides: Partial<GoogleCalendarWorkRow> = {},
): GoogleCalendarWorkRow {
  return {
    booking_id: "b1",
    operation: "upsert",
    attempt_count: 0,
    next_attempt_at: "2026-10-22T00:00:00.000Z",
    last_error: "",
    processed_at: null,
    locked_at: null,
    created_at: "2026-10-22T00:00:00.000Z",
    updated_at: "2026-10-22T00:00:00.000Z",
    ...overrides,
  };
}

interface Seed {
  connection?: Partial<GoogleCalendarConnection>;
  bookings?: Booking[];
  services?: Service[];
  events?: GoogleCalendarEventRow[];
  work?: GoogleCalendarWorkRow[];
  claimable?: boolean;
}

/**
 * Loose in-memory Supabase client for the reconcile adapter. Mirrors the
 * ticket-02 adapter suite so the two seams stay comparable, but the queue is
 * now also observable after a delete cleans up its orphaned row.
 */
function fakeClient(seed: Seed = {}) {
  const state = {
    connection: { ...CONNECTION, ...seed.connection },
    bookings: [...(seed.bookings ?? [])],
    services: [...(seed.services ?? [])],
    events: [...(seed.events ?? [])],
    work: [...(seed.work ?? [])],
  };
  const calls: Array<[string, ...unknown[]]> = [];

  function table(name: string) {
    const rows = () => {
      if (name === "bookings") return state.bookings;
      if (name === "services") return state.services;
      if (name === "google_calendar_events") return state.events;
      if (name === "google_calendar_work") return state.work;
      return [];
    };

    const api = {
      select(columns: string) {
        calls.push(["select", name, columns]);
        const filter = (col: string, value: unknown) => {
          calls.push([`${name}.eq`, col, value]);
          const matched = (rows() as unknown as Array<Record<string, unknown>>).filter(
            (row) => row[col] === value,
          );
          return {
            maybeSingle: async () => {
              calls.push([`${name}.maybeSingle`]);
              return { data: matched[0] ?? null, error: null };
            },
            single: async () => {
              calls.push([`${name}.single`]);
              if (name === "google_calendar_connection") {
                return { data: { ...state.connection }, error: null };
              }
              return { data: matched[0] ?? null, error: null };
            },
            then: (
              resolve: (value: { data: unknown; error: null }) => unknown,
            ) => resolve({ data: matched, error: null }),
          };
        };
        if (name === "google_calendar_connection") {
          return {
            eq: (col: string, value: unknown) => {
              calls.push([`${name}.eq`, col, value]);
              return {
                single: async () => {
                  calls.push([`${name}.single`]);
                  return { data: { ...state.connection }, error: null };
                },
              };
            },
          };
        }
        return {
          eq: filter,
          then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
            resolve({ data: rows(), error: null }),
        };
      },
      insert(values: Record<string, unknown>) {
        calls.push(["insert", name, values]);
        (rows() as unknown as Array<Record<string, unknown>>).push(values);
        return Promise.resolve({ error: null });
      },
      upsert(values: Record<string, unknown>, options?: unknown) {
        calls.push(["upsert", name, values, options]);
        const list = rows() as unknown as Array<Record<string, unknown>>;
        const key = values.booking_id;
        const index = list.findIndex((row) => row.booking_id === key);
        if (index >= 0) list[index] = { ...list[index], ...values };
        else list.push({ ...values });
        return Promise.resolve({ error: null });
      },
      update(values: Record<string, unknown>) {
        calls.push(["update", name, values]);
        return {
          eq: async (col: string, value: unknown) => {
            calls.push([`${name}.update.eq`, col, value]);
            const list =
              name === "google_calendar_connection"
                ? [state.connection as unknown as Record<string, unknown>]
                : (rows() as unknown as Array<Record<string, unknown>>);
            for (const row of list) {
              if (row[col] === value) Object.assign(row, values);
            }
            return { error: null };
          },
        };
      },
      delete() {
        calls.push(["delete", name]);
        return {
          eq: async (col: string, value: unknown) => {
            calls.push([`${name}.delete.eq`, col, value]);
            const list = rows() as unknown as Array<Record<string, unknown>>;
            const index = list.findIndex((row) => row[col] === value);
            if (index >= 0) list.splice(index, 1);
            return { error: null };
          },
        };
      },
    };
    return api;
  }

  const client = {
    from: (name: string) => table(name),
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push(["rpc", name, args]);
      if (name === "enqueue_google_calendar_work") {
        const existing = state.work.find(
          (row) => row.booking_id === args.p_booking_id,
        );
        const next: GoogleCalendarWorkRow = {
          ...work({
            booking_id: String(args.p_booking_id),
            operation: args.p_operation as GoogleCalendarWorkRow["operation"],
          }),
        };
        if (existing) Object.assign(existing, next);
        else state.work.push(next);
        return { data: null, error: null };
      }
      if (name === "claim_google_calendar_work") {
        if (seed.claimable === false) return { data: [], error: null };
        const row = state.work.find(
          (item) =>
            item.booking_id === args.p_booking_id &&
            item.processed_at === null &&
            (item.locked_at === null ||
              Date.parse(item.locked_at) < NOW.getTime() - 10 * 60_000),
        );
        if (!row) return { data: [], error: null };
        row.locked_at = NOW.toISOString();
        return { data: [{ ...row }], error: null };
      }
      return { data: null, error: { message: `unknown rpc ${name}` } };
    },
  };

  return { client: asClient(client), state, calls };
}

interface PortOptions {
  createErrors?: Error[];
  updateErrors?: Error[];
  deleteErrors?: Error[];
  owned?: Array<{ id: string }>;
}

function fakePort(opts: PortOptions = {}): GoogleCalendarPort & {
  calls: Array<[string, ...unknown[]]>;
} {
  const calls: Array<[string, ...unknown[]]> = [];
  const createErrors = [...(opts.createErrors ?? [])];
  const updateErrors = [...(opts.updateErrors ?? [])];
  const deleteErrors = [...(opts.deleteErrors ?? [])];
  let nextId = 1;
  return {
    calls,
    async readCalendar() {},
    async createEvent(calendarId, event: GoogleCalendarEventDraft) {
      calls.push(["create", calendarId, event]);
      const error = createErrors.shift();
      if (error) throw error;
      return { id: `g-created-${nextId++}` };
    },
    async updateEvent(
      calendarId: string,
      eventId: string,
      event: GoogleCalendarEventDraft,
    ) {
      calls.push(["update", calendarId, eventId, event]);
      const error = updateErrors.shift();
      if (error) throw error;
    },
    async deleteEvent(calendarId, eventId) {
      calls.push(["delete", calendarId, eventId]);
      const error = deleteErrors.shift();
      if (error) throw error;
    },
    async listOwnedEvents() {
      calls.push(["listOwned"]);
      return opts.owned ?? [];
    },
  };
}

const runtime = (port: GoogleCalendarPort) => () => ({ config: CONFIG, port });

function missingEventError(): Error {
  return Object.assign(
    new Error("Event Google Calendar tidak ditemukan."),
    { status: 404 },
  );
}

describe("reconcileMirror", () => {
  it("creates an event for a confirmed Booking that has no tracked event", async () => {
    const { client, state } = fakeClient({
      bookings: [booking()],
      services: [SERVICE],
    });
    const port = fakePort();

    const summary = await reconcileMirror(client, runtime(port), NOW);

    expect(port.calls.filter((call) => call[0] === "create")).toHaveLength(1);
    expect(state.events).toEqual([
      expect.objectContaining({ booking_id: "b1", google_event_id: "g-created-1" }),
    ]);
    expect(summary).toMatchObject({
      ok: true,
      created: 1,
      updated: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
      error: null,
    });
  });

  it("updates a tracked event from the current Booking, overwriting hand edits", async () => {
    const { client, state } = fakeClient({
      bookings: [
        booking({
          client_name: "Sinta Baru",
          venue: "Jakarta",
          start_time: "13:00",
          end_time: "15:00",
        }),
      ],
      services: [SERVICE],
      events: [tracked()],
    });
    const port = fakePort();

    const summary = await reconcileMirror(client, runtime(port), NOW);

    expect(port.calls).toContainEqual([
      "update",
      CONFIG.calendarId,
      "g1",
      expect.objectContaining({
        summary: "Sinta Baru — Makeup Wisuda",
        location: "Jakarta",
        start: expect.objectContaining({ dateTime: "2026-11-01T13:00:00+07:00" }),
      }),
    ]);
    expect(port.calls.filter((call) => call[0] === "create")).toHaveLength(0);
    expect(state.events).toEqual([
      expect.objectContaining({ booking_id: "b1", google_event_id: "g1" }),
    ]);
    expect(summary).toMatchObject({ ok: true, updated: 1, failed: 0 });
  });

  it("recreates a tracked event that was hand-deleted in Google", async () => {
    const { client, state } = fakeClient({
      bookings: [booking()],
      services: [SERVICE],
      events: [tracked()],
    });
    const port = fakePort({ updateErrors: [missingEventError()] });

    const summary = await reconcileMirror(client, runtime(port), NOW);

    expect(port.calls).toContainEqual([
      "create",
      CONFIG.calendarId,
      expect.objectContaining({ summary: "Sinta — Makeup Wisuda" }),
    ]);
    expect(state.events).toEqual([
      expect.objectContaining({ booking_id: "b1", google_event_id: "g-created-1" }),
    ]);
    expect(summary).toMatchObject({ ok: true, created: 1, failed: 0 });
  });

  it("deletes the event and tracked row of a hard-deleted Booking", async () => {
    const { client, state } = fakeClient({
      bookings: [],
      events: [tracked("gone", "g-gone")],
      work: [
        work({
          booking_id: "gone",
          operation: "delete",
          processed_at: "2026-10-21T00:00:00.000Z",
        }),
      ],
    });
    const port = fakePort();

    const summary = await reconcileMirror(client, runtime(port), NOW);

    expect(port.calls).toContainEqual(["delete", CONFIG.calendarId, "g-gone"]);
    expect(state.events).toEqual([]);
    expect(state.work).toEqual([]);
    expect(summary).toMatchObject({ ok: true, deleted: 1, failed: 0 });
  });

  it("deletes the event of a future Booking that is no longer confirmed", async () => {
    const { client, state } = fakeClient({
      bookings: [booking({ status: "cancelled" })],
      events: [tracked()],
    });
    const port = fakePort();

    const summary = await reconcileMirror(client, runtime(port), NOW);

    expect(port.calls).toContainEqual(["delete", CONFIG.calendarId, "g1"]);
    expect(port.calls.filter((call) => call[0] === "update")).toHaveLength(0);
    expect(state.events).toEqual([]);
    expect(summary).toMatchObject({ ok: true, deleted: 1 });
  });

  it("treats an already hand-deleted event as deleted and removes its tracked row", async () => {
    const { client, state } = fakeClient({
      bookings: [booking({ status: "cancelled" })],
      events: [tracked()],
    });
    const port = fakePort({ deleteErrors: [missingEventError()] });

    const summary = await reconcileMirror(client, runtime(port), NOW);

    expect(state.events).toEqual([]);
    expect(summary).toMatchObject({ ok: true, deleted: 1, failed: 0 });
  });

  it("leaves past mirrored events and past tracked rows untouched", async () => {
    const { client, state } = fakeClient({
      bookings: [
        booking({ id: "past-confirmed", date: "2026-10-21" }),
        booking({ id: "past-cancelled", date: "2026-09-01", status: "cancelled" }),
        booking({ id: "past-untracked", date: "2026-08-01" }),
      ],
      services: [SERVICE],
      events: [tracked("past-confirmed", "g-past"), tracked("past-cancelled", "g-cancelled")],
      // A leftover intent from a past edit is not a reconcile repair.
      work: [work({ booking_id: "past-confirmed" })],
    });
    const port = fakePort();

    const summary = await reconcileMirror(client, runtime(port), NOW);

    expect(port.calls).toEqual([]);
    expect(state.work[0]?.processed_at).toBeNull();
    expect(state.events).toEqual([
      expect.objectContaining({ booking_id: "past-confirmed", google_event_id: "g-past" }),
      expect.objectContaining({ booking_id: "past-cancelled", google_event_id: "g-cancelled" }),
    ]);
    expect(summary).toMatchObject({
      ok: true,
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
    });
  });

  it("never lists, updates, or deletes a Google event it did not track", async () => {
    const { client, state } = fakeClient({
      bookings: [booking()],
      services: [SERVICE],
    });
    // The fake port would hand this event back if reconcile asked for owned
    // events, so an adoption path would touch it.
    const port = fakePort({ owned: [{ id: "hand-made" }] });

    const summary = await reconcileMirror(client, runtime(port), NOW);

    expect(port.calls.filter((call) => call[0] === "listOwned")).toHaveLength(0);
    expect(
      port.calls.filter(
        (call) => call[0] === "update" && call[2] === "hand-made",
      ),
    ).toHaveLength(0);
    expect(
      port.calls.filter(
        (call) => call[0] === "delete" && call[2] === "hand-made",
      ),
    ).toHaveLength(0);
    expect(port.calls.filter((call) => call[0] === "create")).toHaveLength(1);
    expect(state.events).toEqual([
      expect.objectContaining({ booking_id: "b1", google_event_id: "g-created-1" }),
    ]);
    expect(summary).toMatchObject({ ok: true, created: 1 });
  });

  it("continues after one failure and leaves the failed Booking queued with its error", async () => {
    const { client, state } = fakeClient({
      bookings: [
        booking({ id: "b1" }),
        booking({ id: "b2", date: "2026-11-02" }),
      ],
      services: [SERVICE],
    });
    const port = fakePort({ createErrors: [new Error("Google sedang down")] });

    const summary = await reconcileMirror(client, runtime(port), NOW);

    expect(summary).toMatchObject({
      ok: false,
      created: 1,
      failed: 1,
      error: "Google sedang down",
    });
    expect(state.events).toEqual([
      expect.objectContaining({ booking_id: "b2" }),
    ]);
    expect(
      state.work.find((row) => row.booking_id === "b1"),
    ).toMatchObject({
      processed_at: null,
      last_error: "Google sedang down",
      attempt_count: 1,
    });
    expect(state.connection.last_error).toMatch(/Google sedang down/);
  });

  it("is idempotent: a second reconcile updates rather than duplicates", async () => {
    const { client, state } = fakeClient({
      bookings: [booking()],
      services: [SERVICE],
    });
    const port = fakePort();

    const first = await reconcileMirror(client, runtime(port), NOW);
    const second = await reconcileMirror(
      client,
      runtime(port),
      new Date(NOW.getTime() + 60_000),
    );

    expect(first).toMatchObject({ ok: true, created: 1 });
    expect(second).toMatchObject({ ok: true, created: 0, updated: 1 });
    expect(port.calls.filter((call) => call[0] === "create")).toHaveLength(1);
    expect(port.calls.filter((call) => call[0] === "update")).toHaveLength(1);
    expect(state.events).toHaveLength(1);
  });

  it("drains leftover queue work as part of the reconcile", async () => {
    const { client, state } = fakeClient({
      bookings: [booking()],
      services: [SERVICE],
      work: [work({ attempt_count: 2, last_error: "timeout" })],
    });
    const port = fakePort();

    const summary = await reconcileMirror(client, runtime(port), NOW);

    expect(port.calls.filter((call) => call[0] === "create")).toHaveLength(1);
    expect(state.events).toEqual([
      expect.objectContaining({ booking_id: "b1", google_event_id: "g-created-1" }),
    ]);
    expect(state.work[0]).toMatchObject({ processed_at: expect.any(String), last_error: "" });
    expect(summary).toMatchObject({ ok: true, created: 1, failed: 0 });
    expect(state.connection.last_error).toBe("");
  });

  it("does nothing and writes no Google event while the mirror is disabled", async () => {
    const { client, state } = fakeClient({
      connection: { enabled: false },
      bookings: [booking()],
      services: [SERVICE],
      work: [work()],
    });
    const port = fakePort();

    const summary = await reconcileMirror(client, runtime(port), NOW);

    expect(port.calls).toEqual([]);
    expect(state.events).toEqual([]);
    expect(summary).toMatchObject({
      ok: true,
      disabled: true,
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
    });
  });
});

describe("cron secret", () => {
  const request = (headers: Record<string, string>) =>
    new Request("https://mua.test/api/cron/google-calendar", { headers });

  it("rejects an absent secret", () => {
    expect(isCronAuthorized(request({}), "s3cret")).toBe(false);
    expect(isCronSecretValid("", "s3cret")).toBe(false);
    expect(isCronSecretValid("s3cret", "")).toBe(false);
  });

  it("rejects a wrong secret", () => {
    expect(
      isCronAuthorized(request({ authorization: "Bearer salah" }), "s3cret"),
    ).toBe(false);
    expect(
      isCronAuthorized(request({ "x-cron-secret": "salah" }), "s3cret"),
    ).toBe(false);
  });

  it("accepts the Vercel bearer or the manual header", () => {
    expect(
      isCronAuthorized(request({ authorization: "Bearer s3cret" }), "s3cret"),
    ).toBe(true);
    expect(
      isCronAuthorized(request({ "x-cron-secret": "s3cret" }), "s3cret"),
    ).toBe(true);
  });

  it("reads GOOGLE_CALENDAR_CRON_SECRET first and falls back to CRON_SECRET", () => {
    expect(
      readCronSecret({
        GOOGLE_CALENDAR_CRON_SECRET: "mirror-secret",
        CRON_SECRET: "vercel-secret",
      }),
    ).toBe("mirror-secret");
    expect(readCronSecret({ CRON_SECRET: "vercel-secret" })).toBe(
      "vercel-secret",
    );
    expect(readCronSecret({})).toBe("");
  });
});

describe("Vercel cron config", () => {
  it("declares exactly one daily cron near midnight WIB", () => {
    const config = JSON.parse(
      readFileSync(join(__dirname, "..", "..", "..", "vercel.json"), "utf8"),
    ) as { crons?: Array<{ path: string; schedule: string }> };
    expect(config.crons).toEqual([
      { path: "/api/cron/google-calendar", schedule: "0 17 * * *" },
    ]);
  });
});
