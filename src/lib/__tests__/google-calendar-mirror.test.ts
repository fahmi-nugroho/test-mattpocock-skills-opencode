import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { drainMirrorQueue } from "../google/mirror";
import type { GoogleCalendarConfig } from "../google/config";
import type {
  GoogleCalendarEventDraft,
  GoogleCalendarPort,
} from "../google/port";
import { deriveMirrorState } from "../google/mirror-state";
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
const TODAY = "2026-10-22";

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
 * Loose in-memory Supabase client: tables, the two mirror RPCs, and the
 * connection read/update the adapter uses. Deliberately small — the behaviour
 * under test is the adapter, not PostgREST semantics.
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
        return { eq: filter, then: (resolve: (value: { data: unknown; error: null }) => unknown) => resolve({ data: rows(), error: null }) };
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
  updateError?: Error;
  deleteError?: Error;
  owned?: Array<{ id: string }>;
  /** Runs inside create, while the drain still holds its claim. */
  onCreate?: () => void | Promise<void>;
}

function fakePort(opts: PortOptions = {}): GoogleCalendarPort & {
  calls: Array<[string, ...unknown[]]>;
} {
  const calls: Array<[string, ...unknown[]]> = [];
  const createErrors = [...(opts.createErrors ?? [])];
  let nextId = 1;
  return {
    calls,
    async readCalendar() {},
    async createEvent(calendarId, event: GoogleCalendarEventDraft) {
      calls.push(["create", calendarId, event]);
      const error = createErrors.shift();
      if (error) throw error;
      await opts.onCreate?.();
      return { id: `g-created-${nextId++}` };
    },
    async updateEvent(
      calendarId: string,
      eventId: string,
      event: GoogleCalendarEventDraft,
    ) {
      calls.push(["update", calendarId, eventId, event]);
      if (opts.updateError) throw opts.updateError;
    },
    async deleteEvent(calendarId, eventId) {
      calls.push(["delete", calendarId, eventId]);
      if (opts.deleteError) throw opts.deleteError;
    },
    async listOwnedEvents() {
      calls.push(["listOwned"]);
      return opts.owned ?? [];
    },
  };
}

const runtime = (port: GoogleCalendarPort) => () => ({ config: CONFIG, port });

// Seam 2 (adapter): drain the mirror queue through an injected Google port
// and a mocked Supabase client. Catches a duplicate event, a lost event id, a
// Google failure that throws into the save path, or a backfill that floods
// history. Misses live Google/REST and RLS.
describe("drainMirrorQueue", () => {
  it("creates one event and stores its Google id before the intent is processed", async () => {
    const { client, state, calls } = fakeClient({
      bookings: [booking()],
      services: [SERVICE],
      work: [work()],
    });
    const port = fakePort();

    const result = await drainMirrorQueue(client, runtime(port), NOW);

    expect(port.calls.filter((call) => call[0] === "create")).toHaveLength(1);
    const create = port.calls.find((call) => call[0] === "create");
    expect(create?.[2]).toMatchObject({
      summary: "Sinta — Makeup Wisuda",
      location: "Bandung",
    });
    expect(state.events).toEqual([
      expect.objectContaining({ booking_id: "b1", google_event_id: "g-created-1" }),
    ]);
    expect(state.work[0]?.processed_at).not.toBeNull();
    expect(result).toMatchObject({ ok: true, failed: 0, results: [
      { bookingId: "b1", operation: "upsert", outcome: "created", error: null },
    ] });

    // The id is stored before the queue row is marked processed.
    const storeIndex = calls.findIndex(
      (call) =>
        call[0] === "upsert" && call[1] === "google_calendar_events",
    );
    const processIndex = calls.findIndex(
      (call) =>
        call[0] === "update" &&
        call[1] === "google_calendar_work" &&
        (call[2] as { processed_at?: unknown }).processed_at !== null,
    );
    expect(storeIndex).toBeGreaterThanOrEqual(0);
    expect(processIndex).toBeGreaterThan(storeIndex);
  });

  it("updates the stored Google event when a Booking is edited", async () => {
    const { client, state } = fakeClient({
      bookings: [booking()],
      services: [SERVICE],
      events: [tracked()],
      work: [work()],
    });
    const port = fakePort();

    const result = await drainMirrorQueue(client, runtime(port), NOW);

    expect(port.calls.filter((call) => call[0] === "create")).toHaveLength(0);
    expect(port.calls).toContainEqual([
      "update",
      CONFIG.calendarId,
      "g1",
      expect.objectContaining({ summary: "Sinta — Makeup Wisuda" }),
    ]);
    expect(state.events).toEqual([
      expect.objectContaining({ booking_id: "b1", google_event_id: "g1" }),
    ]);
    expect(result.results[0]).toMatchObject({ outcome: "updated" });
  });

  it("deletes the Google event when the Booking leaves confirmed", async () => {
    const { client, state } = fakeClient({
      bookings: [booking({ status: "cancelled" })],
      events: [tracked()],
      work: [work({ operation: "delete" })],
    });
    const port = fakePort();

    const result = await drainMirrorQueue(client, runtime(port), NOW);

    expect(port.calls).toContainEqual(["delete", CONFIG.calendarId, "g1"]);
    expect(state.events).toEqual([]);
    expect(result.results[0]).toMatchObject({ outcome: "deleted" });
  });

  it("removes a hard-deleted Booking's event because the tracked row survived", async () => {
    const { client, state } = fakeClient({
      bookings: [],
      events: [tracked("gone", "g-gone")],
      work: [work({ booking_id: "gone", operation: "delete" })],
    });
    const port = fakePort();

    await drainMirrorQueue(client, runtime(port), NOW);

    expect(port.calls).toContainEqual(["delete", CONFIG.calendarId, "g-gone"]);
    expect(state.events).toEqual([]);
  });

  it("leaves the intent open with its error when Google fails, without throwing", async () => {
    const { client, state } = fakeClient({
      bookings: [booking()],
      services: [SERVICE],
      work: [work()],
    });
    const port = fakePort({ createErrors: [new Error("Google sedang down")] });

    const result = await drainMirrorQueue(client, runtime(port), NOW);

    expect(result.ok).toBe(false);
    expect(result.failed).toBe(1);
    expect(result.results[0]).toMatchObject({
      bookingId: "b1",
      outcome: "failed",
      error: "Google sedang down",
    });
    expect(state.events).toEqual([]);
    expect(state.work[0]).toMatchObject({
      booking_id: "b1",
      processed_at: null,
      attempt_count: 1,
      last_error: "Google sedang down",
    });
    expect(state.work[0]?.next_attempt_at).not.toBe(NOW.toISOString());
    expect(state.connection.last_error).toMatch(/Google sedang down/);

    // The failure is visible on the Booking, derived from the open row.
    expect(
      deriveMirrorState("confirmed", null, state.work[0] ?? null),
    ).toBe("failed");
  });

  it("retries the open intent on a later drain and succeeds", async () => {
    const { client, state } = fakeClient({
      bookings: [booking()],
      services: [SERVICE],
      work: [work()],
    });
    const failing = fakePort({ createErrors: [new Error("timeout")] });
    await drainMirrorQueue(client, runtime(failing), NOW);

    const later = new Date(NOW.getTime() + 10 * 60_000);
    const retry = fakePort();
    const result = await drainMirrorQueue(client, runtime(retry), later);

    expect(result).toMatchObject({ ok: true, failed: 0 });
    expect(retry.calls.filter((call) => call[0] === "create")).toHaveLength(1);
    expect(state.events).toEqual([
      expect.objectContaining({ google_event_id: "g-created-1" }),
    ]);
    expect(state.work[0]?.processed_at).not.toBeNull();
    expect(state.connection.last_error).toBe("");
  });

  it("backfills confirmed Bookings from today forward, skipping past and tracked rows", async () => {
    const { client, state } = fakeClient({
      bookings: [
        booking({ id: "past", date: "2026-10-21" }),
        booking({ id: "today", date: TODAY }),
        booking({ id: "future", date: "2026-12-01" }),
        booking({ id: "later", date: "2026-12-02" }),
      ],
      services: [SERVICE],
      events: [tracked("future", "g-future")],
    });
    const port = fakePort();

    const result = await drainMirrorQueue(client, runtime(port), NOW);

    expect(port.calls.filter((call) => call[0] === "create")).toHaveLength(2);
    expect(state.events.map((row) => row.booking_id).sort()).toEqual([
      "future",
      "later",
      "today",
    ]);
    // The tracked future row is not adopted by the backfill, but its event
    // remains untouched; past stays out entirely.
    expect(state.events.find((row) => row.booking_id === "past")).toBeUndefined();
    expect(result.backfilled).toBe(2);
  });

  it("creates no duplicate when the same drain runs twice", async () => {
    const { client, state } = fakeClient({
      bookings: [booking()],
      services: [SERVICE],
    });
    const port = fakePort();

    await drainMirrorQueue(client, runtime(port), NOW);
    await drainMirrorQueue(client, runtime(port), new Date(NOW.getTime() + 60_000));

    expect(port.calls.filter((call) => call[0] === "create")).toHaveLength(1);
    expect(state.events).toHaveLength(1);
  });

  it("takes a per-Booking lock and re-reads the tracked row before creating", async () => {
    const { client, calls } = fakeClient({
      bookings: [booking()],
      services: [SERVICE],
      work: [work()],
    });
    const port = fakePort();

    await drainMirrorQueue(client, runtime(port), NOW);

    const claimIndex = calls.findIndex(
      (call) =>
        call[0] === "rpc" && call[1] === "claim_google_calendar_work",
    );
    const rereadIndex = calls.findIndex(
      (call) => call[0] === "google_calendar_events.maybeSingle",
    );
    expect(claimIndex).toBeGreaterThanOrEqual(0);
    expect(rereadIndex).toBeGreaterThan(claimIndex);
  });

  it("does nothing for a Booking another drain already holds", async () => {
    const { client } = fakeClient({
      bookings: [booking()],
      services: [SERVICE],
      work: [work()],
      claimable: false,
    });
    const port = fakePort();

    const result = await drainMirrorQueue(client, runtime(port), NOW);

    expect(port.calls).toEqual([]);
    expect(result.results).toEqual([]);
  });

  it("continues after one failure so another Booking still reaches Google", async () => {
    const { client, state } = fakeClient({
      bookings: [
        booking({ id: "b1" }),
        booking({ id: "b2", date: "2026-11-02" }),
      ],
      services: [SERVICE],
      work: [work({ booking_id: "b1" }), work({ booking_id: "b2" })],
    });
    const port = fakePort({ createErrors: [new Error("gagal b1")] });

    const result = await drainMirrorQueue(client, runtime(port), NOW);

    expect(result.failed).toBe(1);
    expect(result.results).toHaveLength(2);
    expect(state.events).toEqual([
      expect.objectContaining({ booking_id: "b2" }),
    ]);
    expect(
      state.work.find((row) => row.booking_id === "b1")?.processed_at,
    ).toBeNull();
    expect(
      state.work.find((row) => row.booking_id === "b2")?.processed_at,
    ).not.toBeNull();
  });

  it("adopts an owned event instead of creating a duplicate when the id was lost", async () => {
    const { client, state } = fakeClient({
      bookings: [booking()],
      services: [SERVICE],
      work: [work()],
    });
    const port = fakePort({ owned: [{ id: "g-owned" }] });

    const result = await drainMirrorQueue(client, runtime(port), NOW);

    expect(port.calls.filter((call) => call[0] === "create")).toHaveLength(0);
    expect(port.calls).toContainEqual([
      "update",
      CONFIG.calendarId,
      "g-owned",
      expect.objectContaining({ summary: "Sinta — Makeup Wisuda" }),
    ]);
    expect(state.events).toEqual([
      expect.objectContaining({ booking_id: "b1", google_event_id: "g-owned" }),
    ]);
    expect(result.results[0]).toMatchObject({ outcome: "updated" });
  });

  it("deletes an owned event even when the tracked row is missing", async () => {
    const { client, state } = fakeClient({
      bookings: [],
      work: [work({ booking_id: "gone", operation: "delete" })],
    });
    const port = fakePort({ owned: [{ id: "g-orphan" }] });

    const result = await drainMirrorQueue(client, runtime(port), NOW);

    expect(port.calls).toContainEqual(["delete", CONFIG.calendarId, "g-orphan"]);
    expect(state.events).toEqual([]);
    expect(result.results[0]).toMatchObject({ outcome: "deleted" });
  });

  it("keeps a newer intent open when the Booking changes mid-drain", async () => {
    const { client, state } = fakeClient({
      bookings: [booking()],
      services: [SERVICE],
      work: [work()],
    });
    let changed = false;
    const port = fakePort({
      onCreate: async () => {
        if (changed) return;
        changed = true;
        await (client as unknown as {
          rpc(
            name: string,
            args: Record<string, unknown>,
          ): Promise<{ error: unknown }>;
        }).rpc("enqueue_google_calendar_work", {
          p_booking_id: "b1",
          p_operation: "delete",
        });
      },
    });

    const first = await drainMirrorQueue(client, runtime(port), NOW);

    expect(first.results[0]).toMatchObject({
      operation: "upsert",
      outcome: "created",
    });
    // The event exists, but the newer delete is still owed.
    expect(state.events).toHaveLength(1);
    expect(state.work[0]).toMatchObject({
      operation: "delete",
      processed_at: null,
    });

    const later = new Date(NOW.getTime() + 60_000);
    await drainMirrorQueue(client, runtime(port), later);

    expect(port.calls.filter((call) => call[0] === "delete")).toHaveLength(1);
    expect(state.events).toEqual([]);
    expect(state.work[0]?.processed_at).not.toBeNull();
  });

  it("refuses to drain while the mirror is disconnected", async () => {
    const { client } = fakeClient({ connection: { enabled: false } });
    const port = fakePort();

    await expect(
      drainMirrorQueue(client, runtime(port), NOW),
    ).rejects.toThrow(/belum terhubung/i);
    expect(port.calls).toEqual([]);
  });
});
