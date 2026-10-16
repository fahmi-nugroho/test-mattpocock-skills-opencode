import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { updateProfileSettings } from "../supabase/admin-settings";
import type { Database } from "../supabase/database";

type TypedClient = SupabaseClient<Database>;
const asClient = (client: unknown): TypedClient =>
  client as unknown as TypedClient;

// Seam (adapter): profil settings write with injected client.
// Catches wrong table/filter/payload and swallowed errors.
// Misses live RLS behavior.
describe("updateProfileSettings", () => {
  it("updates headline/subcopy/portrait_url on row id = 1", async () => {
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
      updateProfileSettings(asClient(client), {
        headline: "Halo",
        subcopy: "Deskripsi",
        portrait_url: "https://example.com/p.jpg",
      }),
    ).resolves.toBeUndefined();
    expect(calls).toContainEqual(["from", "settings"]);
    expect(calls).toContainEqual([
      "update",
      {
        headline: "Halo",
        subcopy: "Deskripsi",
        portrait_url: "https://example.com/p.jpg",
      },
    ]);
    expect(calls).toContainEqual(["eq", "id", 1]);
  });

  it("persists a null portrait when the admin clears the photo", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const client = {
      from: () => ({
        update: (values: unknown) => {
          calls.push(["update", values]);
          return {
            eq: async () => ({ error: null }),
          };
        },
      }),
    };
    await updateProfileSettings(asClient(client), {
      headline: "Halo",
      subcopy: "Deskripsi",
      portrait_url: null,
    });
    expect(calls).toContainEqual([
      "update",
      { headline: "Halo", subcopy: "Deskripsi", portrait_url: null },
    ]);
  });

  it("propagates save errors instead of pretending the hero updated", async () => {
    const client = {
      from: () => ({
        update: () => ({
          eq: async () => ({ error: { message: "rls denied" } }),
        }),
      }),
    };
    await expect(
      updateProfileSettings(asClient(client), {
        headline: "Halo",
        subcopy: "Deskripsi",
        portrait_url: null,
      }),
    ).rejects.toThrow(/rls denied/);
  });
});
