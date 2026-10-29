import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  connectCalendar,
  disconnectCalendar,
  getConnection,
  getEnabledConnection,
  isMirrorUnhealthy,
  testCalendarConnection,
  type MirrorRuntimeFactory,
} from "../google/calendar-connection";
import {
  GOOGLE_CONFIG_ERROR,
  GoogleCalendarConfigError,
  type GoogleCalendarConfig,
} from "../google/config";
import { isMirrorStatusUnhealthy } from "../google/connection-status";
import type {
  GoogleCalendarEventDraft,
  GoogleCalendarPort,
} from "../google/port";
import type { Database, GoogleCalendarConnection } from "../supabase/database";

type TypedClient = SupabaseClient<Database>;
const asClient = (client: unknown): TypedClient =>
  client as unknown as TypedClient;

const CONFIG: GoogleCalendarConfig = {
  serviceAccountEmail: "mirror@mua.iam.gserviceaccount.com",
  privateKey: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
  calendarId: "mua-booking@group.calendar.google.com",
};

const ROW: GoogleCalendarConnection = {
  id: 1,
  enabled: false,
  calendar_id: "",
  last_verified_at: null,
  last_error: "",
  updated_at: "2026-10-01T00:00:00.000Z",
};

function fakePort(opts: {
  readError?: Error;
  createError?: Error;
  deleteError?: Error;
} = {}): GoogleCalendarPort & { calls: Array<[string, ...unknown[]]> } {
  const calls: Array<[string, ...unknown[]]> = [];
  return {
    calls,
    async readCalendar(calendarId) {
      calls.push(["read", calendarId]);
      if (opts.readError) throw opts.readError;
    },
    async createEvent(calendarId: string, event: GoogleCalendarEventDraft) {
      calls.push(["create", calendarId, event]);
      if (opts.createError) throw opts.createError;
      return { id: "probe-1" };
    },
    async updateEvent(
      calendarId: string,
      eventId: string,
      event: GoogleCalendarEventDraft,
    ) {
      calls.push(["update", calendarId, eventId, event]);
    },
    async deleteEvent(calendarId, eventId) {
      calls.push(["delete", calendarId, eventId]);
      if (opts.deleteError) throw opts.deleteError;
    },
    async listOwnedEvents() {
      return [];
    },
  };
}

function connectionClient(initial: Partial<GoogleCalendarConnection> = {}) {
  const row: GoogleCalendarConnection = { ...ROW, ...initial };
  const updates: Array<Record<string, unknown>> = [];
  const calls: Array<[string, ...unknown[]]> = [];
  const client = {
    from: (table: string) => {
      calls.push(["from", table]);
      return {
        select: (cols: string) => {
          calls.push(["select", cols]);
          return {
            eq: (col: string, value: unknown) => {
              calls.push(["eq", col, value]);
              return {
                single: async () => ({ data: { ...row }, error: null }),
              };
            },
          };
        },
        update: (values: Record<string, unknown>) => {
          calls.push(["update", values]);
          updates.push(values);
          Object.assign(row, values);
          return {
            eq: async (col: string, value: unknown) => {
              calls.push(["update.eq", col, value]);
              return { error: null };
            },
          };
        },
      };
    },
  };
  return { client: asClient(client), row, updates, calls };
}

const runtime =
  (port: GoogleCalendarPort): MirrorRuntimeFactory =>
  () => ({ config: CONFIG, port });

const NOW = new Date("2026-10-22T03:04:05.000Z");

// Seam 2 (adapter): connection test/enable/disable through an injected Google
// port and a mocked Supabase client. Catches a swallowed write failure, a
// mirror enabled without a successful check, or a disconnect that touches
// Google. Misses live Google/REST and RLS behaviour.
describe("testCalendarConnection", () => {
  it("reads the calendar, creates then deletes a labelled probe, and records the verified time", async () => {
    const { client, updates } = connectionClient({ last_error: "error lama" });
    const port = fakePort();

    const result = await testCalendarConnection(client, runtime(port), NOW);

    expect(result).toEqual({ ok: true, error: null });
    expect(port.calls[0]).toEqual(["read", CONFIG.calendarId]);
    const create = port.calls.find((c) => c[0] === "create");
    expect(create?.[2]).toMatchObject({
      summary: expect.stringMatching(/tes koneksi/i),
    });
    expect(port.calls).toContainEqual(["delete", CONFIG.calendarId, "probe-1"]);
    expect(updates).toContainEqual({
      calendar_id: CONFIG.calendarId,
      last_verified_at: NOW.toISOString(),
      last_error: "",
      updated_at: NOW.toISOString(),
    });
  });

  it("reports a read-only share as a concrete failure and keeps the stale verification", async () => {
    const { client, updates } = connectionClient({
      last_verified_at: "2026-10-01T00:00:00.000Z",
    });
    const port = fakePort({
      createError: new Error(
        "Akun layanan tidak memiliki izin menulis ke kalender Google.",
      ),
    });

    const result = await testCalendarConnection(client, runtime(port), NOW);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/izin menulis/i);
    const patch = updates.at(-1) ?? {};
    expect(patch.last_error).toMatch(/izin menulis/i);
    expect(patch).not.toHaveProperty("last_verified_at");
    expect(port.calls.some((c) => c[0] === "delete")).toBe(false);
  });

  it("turns a missing configuration into a plain Indonesian message", async () => {
    const { client, updates } = connectionClient();
    const failingRuntime: MirrorRuntimeFactory = () => {
      throw new GoogleCalendarConfigError(GOOGLE_CONFIG_ERROR);
    };

    const result = await testCalendarConnection(client, failingRuntime, NOW);

    expect(result).toEqual({ ok: false, error: GOOGLE_CONFIG_ERROR });
    expect(updates.at(-1)).toMatchObject({ last_error: GOOGLE_CONFIG_ERROR });
  });

  it("reports a failed probe cleanup instead of pretending the test passed", async () => {
    const { client, updates } = connectionClient();
    const port = fakePort({ deleteError: new Error("gagal menghapus") });

    const result = await testCalendarConnection(client, runtime(port), NOW);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/gagal menghapus/);
    expect(result.error).toMatch(/hapus event/i);
    expect(updates.at(-1)?.last_error).toMatch(/hapus event/i);
  });
});

describe("connectCalendar", () => {
  it("enables the mirror only after a successful access check", async () => {
    const { client, updates } = connectionClient();
    const port = fakePort();

    const result = await connectCalendar(client, runtime(port), NOW);

    expect(result).toEqual({ ok: true, error: null });
    expect(updates.at(-1)).toMatchObject({
      enabled: true,
      calendar_id: CONFIG.calendarId,
      last_verified_at: NOW.toISOString(),
      last_error: "",
    });
  });

  it("stays disconnected when the access check fails", async () => {
    const { client, updates } = connectionClient();
    const port = fakePort({
      createError: new Error("Kalender hanya dapat dibaca."),
    });

    const result = await connectCalendar(client, runtime(port), NOW);

    expect(result.ok).toBe(false);
    expect(updates.some((u) => u.enabled === true)).toBe(false);
    expect(updates.at(-1)?.last_error).toBe("Kalender hanya dapat dibaca.");
  });
});

describe("disconnectCalendar", () => {
  it("disables the mirror without writing to Google or deleting any event", async () => {
    const { client, row, updates } = connectionClient({
      enabled: true,
      calendar_id: CONFIG.calendarId,
      last_verified_at: NOW.toISOString(),
    });

    await disconnectCalendar(client, NOW);

    expect(row.enabled).toBe(false);
    expect(updates.at(-1)).toEqual({
      enabled: false,
      updated_at: NOW.toISOString(),
    });
  });

  it("refuses further work after the mirror is disconnected", async () => {
    const { client } = connectionClient({ enabled: true });
    await getEnabledConnection(client);
    await disconnectCalendar(client, NOW);
    await expect(getEnabledConnection(client)).rejects.toThrow(/belum terhubung/i);
  });
});

describe("getConnection / health", () => {
  it("reads the single connection row", async () => {
    const { client } = connectionClient({ enabled: true });
    await expect(getConnection(client)).resolves.toMatchObject({ id: 1, enabled: true });
  });

  it("treats only an enabled connection with an error as unhealthy", () => {
    expect(
      isMirrorUnhealthy({ enabled: true, last_error: "gagal" }),
    ).toBe(true);
    expect(isMirrorUnhealthy({ enabled: true, last_error: "" })).toBe(false);
    expect(
      isMirrorUnhealthy({ enabled: false, last_error: "gagal" }),
    ).toBe(false);
  });

  it("also flags an enabled mirror whose server configuration disappeared", () => {
    expect(
      isMirrorStatusUnhealthy({
        configured: false,
        configError: GOOGLE_CONFIG_ERROR,
        connection: { ...ROW, enabled: true },
      }),
    ).toBe(true);
    expect(
      isMirrorStatusUnhealthy({
        configured: true,
        configError: null,
        connection: { ...ROW, enabled: true, last_error: "" },
      }),
    ).toBe(false);
    expect(isMirrorStatusUnhealthy(null)).toBe(false);
  });
});
