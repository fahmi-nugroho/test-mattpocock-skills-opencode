import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicWaNumber } from "../supabase/public-settings";
import type { Database } from "../supabase/database";

type TypedClient = SupabaseClient<Database>;

/** Cast the recording fake to the typed client (adapter seam). */
const asClient = (client: unknown): TypedClient =>
  client as unknown as TypedClient;

// Seam (adapter): public WA-number fetch via RPC with injected client.
// Catches wrong RPC name and swallowed/blank errors. Misses live RLS.
describe("getPublicWaNumber", () => {
  it("calls the public WA RPC and returns the number", async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const fakeClient = {
      rpc: async (name: string, args: unknown) => {
        calls.push({ name, args });
        return { data: "6281234567890", error: null };
      },
    };
    await expect(getPublicWaNumber(asClient(fakeClient))).resolves.toBe("6281234567890");
    expect(calls).toEqual([{ name: "get_public_wa_number", args: {} }]);
  });

  it("throws instead of returning a blank WA link on empty value", async () => {
    const fakeClient = {
      rpc: async () => ({ data: "", error: null }),
    };
    await expect(getPublicWaNumber(asClient(fakeClient))).rejects.toThrow(/wa number/i);
  });

  it("propagates RPC errors instead of hiding a broken contact button", async () => {
    const fakeClient = {
      rpc: async () => ({ data: null, error: { message: "db down" } }),
    };
    await expect(getPublicWaNumber(asClient(fakeClient))).rejects.toThrow(/db down/);
  });
});
