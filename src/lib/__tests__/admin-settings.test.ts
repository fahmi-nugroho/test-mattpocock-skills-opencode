import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSettings, updateSettings } from "../supabase/admin-settings";
import type { Database } from "../supabase/database";

type TypedClient = SupabaseClient<Database>;
const asClient = (client: unknown): TypedClient =>
  client as unknown as TypedClient;

// Seam 3a (adapter): settings read/write with injected client.
// Catches wrong table/filter/payload and swallowed errors.
// Misses live RLS behavior.
describe("getSettings", () => {
  it("reads the single settings row (id = 1)", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const row = {
      id: 1,
      wa_number: "6281234567890",
      full_dates: [],
      bank_name: "BCA",
      account_name: "Wandana",
      account_number: "1234567890",
      instagram_handle: "wandanamakeup",
    };
    const client = {
      from: (table: string) => {
        calls.push(["from", table]);
        return {
          select: (cols: string) => {
            calls.push(["select", cols]);
            return {
              eq: (col: string, val: unknown) => {
                calls.push(["eq", col, val]);
                return {
                  single: async () => ({ data: row, error: null }),
                };
              },
            };
          },
        };
      },
    };
    await expect(getSettings(asClient(client))).resolves.toEqual(row);
    expect(calls).toContainEqual(["from", "settings"]);
    expect(calls).toContainEqual(["eq", "id", 1]);
  });

  it("throws instead of rendering an empty form on error", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: { message: "db down" } }),
          }),
        }),
      }),
    };
    await expect(getSettings(asClient(client))).rejects.toThrow(/db down/);
  });

  it("throws when the settings row is missing", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({ single: async () => ({ data: null, error: null }) }),
        }),
      }),
    };
    await expect(getSettings(asClient(client))).rejects.toThrow(/settings/i);
  });
});

const SETTINGS = {
  wa_number: "6281234567890",
  bank_name: "BCA",
  account_name: "Wandana",
  account_number: "1234567890",
  instagram_handle: "wandanamakeup",
};

describe("updateSettings", () => {
  it("updates the WA number and four payment fields on row id = 1", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const client = {
      from: (table: string) => {
        calls.push(["from", table]);
        return {
          update: (values: unknown) => {
            calls.push(["update", values]);
            return {
              eq: (col: string, val: unknown) => {
                calls.push(["eq", col, val]);
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
    };
    await expect(
      updateSettings(asClient(client), SETTINGS),
    ).resolves.toBeUndefined();
    expect(calls).toContainEqual(["from", "settings"]);
    expect(calls).toContainEqual(["update", SETTINGS]);
    expect(calls).toContainEqual(["eq", "id", 1]);
  });

  it("saves empty payment details so the invoice can print an em dash", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const client = {
      from: () => ({
        update: (values: unknown) => {
          calls.push(["update", values]);
          return {
            eq: (col: string, val: unknown) => {
              calls.push(["eq", col, val]);
              return Promise.resolve({ error: null });
            },
          };
        },
      }),
    };
    await updateSettings(asClient(client), {
      ...SETTINGS,
      bank_name: "",
      account_name: "",
      account_number: "",
      instagram_handle: "",
    });
    expect(calls).toContainEqual([
      "update",
      {
        ...SETTINGS,
        bank_name: "",
        account_name: "",
        account_number: "",
        instagram_handle: "",
      },
    ]);
  });

  it("propagates save errors instead of pretending the calendar updated", async () => {
    const client = {
      from: () => ({
        update: () => ({
          eq: async () => ({ error: { message: "rls denied" } }),
        }),
      }),
    };
    await expect(
      updateSettings(asClient(client), SETTINGS),
    ).rejects.toThrow(/rls denied/);
  });
});
