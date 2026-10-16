import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicProfile } from "../supabase/public-profile";
import type { Database } from "../supabase/database";

type TypedClient = SupabaseClient<Database>;

/** Cast the recording fake to the typed client (adapter seam). */
const asClient = (client: unknown): TypedClient =>
  client as unknown as TypedClient;

// Seam (adapter): public profil fetch via RPC with injected client.
// Catches wrong RPC name and swallowed/blank errors. Misses live RLS.
describe("getPublicProfile", () => {
  it("calls the public profile RPC and returns headline/subcopy/portrait", async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const row = {
      headline: "Tampil memukau di hari spesialmu",
      subcopy: "Lihat portfolio lalu chat WhatsApp.",
      portrait_url: "https://example.com/p.jpg",
    };
    const fakeClient = {
      rpc: async (name: string, args: unknown) => {
        calls.push({ name, args });
        return { data: row, error: null };
      },
    };
    await expect(getPublicProfile(asClient(fakeClient))).resolves.toEqual(row);
    expect(calls).toEqual([{ name: "get_public_profile", args: {} }]);
  });

  it("returns a null portrait when the admin has not uploaded one", async () => {
    const fakeClient = {
      rpc: async () => ({
        data: { headline: "H", subcopy: "S", portrait_url: null },
        error: null,
      }),
    };
    await expect(getPublicProfile(asClient(fakeClient))).resolves.toEqual({
      headline: "H",
      subcopy: "S",
      portrait_url: null,
    });
  });

  it("throws instead of returning blank copy on missing row", async () => {
    const fakeClient = {
      rpc: async () => ({ data: null, error: null }),
    };
    await expect(getPublicProfile(asClient(fakeClient))).rejects.toThrow(
      /profile/i,
    );
  });

  it("propagates RPC errors instead of hiding a broken hero", async () => {
    const fakeClient = {
      rpc: async () => ({ data: null, error: { message: "db down" } }),
    };
    await expect(getPublicProfile(asClient(fakeClient))).rejects.toThrow(
      /db down/,
    );
  });

  it("accepts the RETURNS TABLE array shape (supabase-js returns rows)", async () => {
    const row = {
      headline: "Tampil memukau di hari spesialmu",
      subcopy: "Lihat portfolio lalu chat WhatsApp.",
      portrait_url: "https://example.com/p.jpg",
    };
    const fakeClient = {
      rpc: async () => ({ data: [row], error: null }),
    };
    await expect(getPublicProfile(asClient(fakeClient))).resolves.toEqual(row);
  });

  it("throws on an empty array (missing settings row)", async () => {
    const fakeClient = {
      rpc: async () => ({ data: [], error: null }),
    };
    await expect(getPublicProfile(asClient(fakeClient))).rejects.toThrow(
      /profile/i,
    );
  });

  it("throws on an array row with blank headline", async () => {
    const fakeClient = {
      rpc: async () => ({
        data: [{ headline: "   ", subcopy: "S", portrait_url: null }],
        error: null,
      }),
    };
    await expect(getPublicProfile(asClient(fakeClient))).rejects.toThrow(
      /profile/i,
    );
  });
});
