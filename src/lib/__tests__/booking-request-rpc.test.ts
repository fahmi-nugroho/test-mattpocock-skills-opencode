import { describe, expect, it } from "vitest";
import {
  readBookingRequest,
  submitBookingRequest,
} from "../booking-request";
import type { RpcClient } from "../month-availability";

const TOKEN = "abc123def456";

const VALID_PAYLOAD = {
  client_name: "Sari",
  client_phone: "08123456789",
  event_type: "Akad",
  headcount: 3,
  venue: "Rumah mempelai",
  hairdo: "Sanggul",
  notes: "datang pagi",
  date: "2026-11-01",
  start_time: "09:00",
  end_time: "12:00",
};

function recorder(data: unknown, error: { message: string } | null = null): {
  client: RpcClient;
  calls: Array<{ name: string; args: unknown }>;
} {
  const calls: Array<{ name: string; args: unknown }> = [];
  const client: RpcClient = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data, error };
    },
  };
  return { client, calls };
}

// Seam 2 (adapter): RPC wrapper with injected client. Catches wrong RPC
// name/args, swallowed errors, and mis-mapped outcomes. Misses live RLS.
describe("readBookingRequest", () => {
  it("calls get_booking_request with the token and maps the context", async () => {
    const { client, calls } = recorder({
      state: "open",
      client_name: "Sari",
      date: "2026-11-01",
      start_time: "09:00",
      end_time: "12:00",
    });
    const result = await readBookingRequest(client, TOKEN);
    expect(calls).toEqual([
      { name: "get_booking_request", args: { p_token: TOKEN } },
    ]);
    expect(result).toEqual({
      state: "open",
      client_name: "Sari",
      date: "2026-11-01",
      start_time: "09:00",
      end_time: "12:00",
    });
  });

  it("rejects a blank token before hitting the RPC", async () => {
    let called = false;
    const client: RpcClient = {
      rpc: async () => {
        called = true;
        return { data: null, error: null };
      },
    };
    await expect(readBookingRequest(client, "  ")).rejects.toThrow(/token/i);
    expect(called).toBe(false);
  });

  it("propagates RPC errors instead of returning a state", async () => {
    const { client } = recorder(null, { message: "boom" });
    await expect(readBookingRequest(client, TOKEN)).rejects.toThrow(
      /RPC failed: boom/,
    );
  });

  it("throws on a malformed RPC response shape", async () => {
    const { client } = recorder({ state: "accepted" });
    await expect(readBookingRequest(client, TOKEN)).rejects.toThrow(/state/i);
  });
});

// Seam 2 (adapter): submit wrapper with injected client. Validates the
// payload before the call and surfaces each refusal distinctly.
describe("submitBookingRequest", () => {
  it("calls submit_booking_request with the token and validated payload", async () => {
    const { client, calls } = recorder({ ok: true, state: "submitted" });
    const result = await submitBookingRequest(client, TOKEN, VALID_PAYLOAD);
    expect(calls).toEqual([
      {
        name: "submit_booking_request",
        args: { p_token: TOKEN, p_payload: VALID_PAYLOAD },
      },
    ]);
    expect(result).toEqual({ ok: true, state: "submitted" });
  });

  it("rejects an invalid payload before hitting the RPC", async () => {
    let called = false;
    const client: RpcClient = {
      rpc: async () => {
        called = true;
        return { data: { ok: true, state: "submitted" }, error: null };
      },
    };
    await expect(
      submitBookingRequest(client, TOKEN, {
        ...VALID_PAYLOAD,
        client_name: "",
      }),
    ).rejects.toThrow(/nama/i);
    expect(called).toBe(false);
  });

  it("propagates RPC errors instead of reporting a refusal", async () => {
    const { client } = recorder(null, { message: "boom" });
    await expect(
      submitBookingRequest(client, TOKEN, VALID_PAYLOAD),
    ).rejects.toThrow(/RPC failed: boom/);
  });

  it("surfaces expired distinctly from already-submitted and not-found", async () => {
    const expired = recorder({ ok: false, reason: "expired" });
    await expect(
      submitBookingRequest(expired.client, TOKEN, VALID_PAYLOAD),
    ).resolves.toEqual({ ok: false, reason: "expired" });

    const submitted = recorder({ ok: false, reason: "already_submitted" });
    await expect(
      submitBookingRequest(submitted.client, TOKEN, VALID_PAYLOAD),
    ).resolves.toEqual({ ok: false, reason: "already_submitted" });

    const missing = recorder({ ok: false, reason: "not_found" });
    await expect(
      submitBookingRequest(missing.client, TOKEN, VALID_PAYLOAD),
    ).resolves.toEqual({ ok: false, reason: "not_found" });

    const invalid = recorder({ ok: false, reason: "invalid_payload" });
    await expect(
      submitBookingRequest(invalid.client, TOKEN, VALID_PAYLOAD),
    ).resolves.toEqual({ ok: false, reason: "invalid_payload" });
  });

  it("throws on a malformed RPC response shape", async () => {
    const { client } = recorder({ ok: false, reason: "nonsense" });
    await expect(
      submitBookingRequest(client, TOKEN, VALID_PAYLOAD),
    ).rejects.toThrow(/result/i);
  });

  it("rejects a blank token before hitting the RPC", async () => {
    let called = false;
    const client: RpcClient = {
      rpc: async () => {
        called = true;
        return { data: { ok: true, state: "submitted" }, error: null };
      },
    };
    await expect(
      submitBookingRequest(client, "", VALID_PAYLOAD),
    ).rejects.toThrow(/token/i);
    expect(called).toBe(false);
  });
});
