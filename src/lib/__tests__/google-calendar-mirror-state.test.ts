import { describe, expect, it } from "vitest";
import {
  deriveMirrorState,
  indexMirrorStates,
  MIRROR_STATE_LABEL,
} from "../google/mirror-state";
import type {
  Booking,
  GoogleCalendarEventRow,
  GoogleCalendarWorkRow,
} from "../supabase/database";

const TRACKED: GoogleCalendarEventRow = {
  booking_id: "b1",
  google_event_id: "g1",
  last_synced_at: "2026-10-22T01:00:00.000Z",
  updated_at: "2026-10-22T01:00:00.000Z",
};

function work(overrides: Partial<GoogleCalendarWorkRow> = {}): GoogleCalendarWorkRow {
  return {
    booking_id: "b1",
    operation: "upsert",
    attempt_count: 0,
    next_attempt_at: "2026-10-22T01:00:00.000Z",
    last_error: "",
    processed_at: null,
    locked_at: null,
    created_at: "2026-10-22T01:00:00.000Z",
    updated_at: "2026-10-22T01:00:00.000Z",
    ...overrides,
  };
}

function booking(id: string, status: Booking["status"]): Booking {
  return {
    id,
    date: "2026-11-01",
    start_time: "09:00",
    end_time: "10:00",
    service_id: null,
    client_name: "Sinta",
    client_phone: "081234567890",
    notes: "",
    status,
    event_type: "",
    headcount: 1,
    venue: "",
    hairdo: "",
    reference: "",
    total_price: null,
    dp_amount: 0,
  };
}

// Seam 1 (pure state): tracked row + open queue row -> what the row shows.
// Catches a hand-set or drifting badge. Misses render and refresh timing.
describe("deriveMirrorState", () => {
  it("shows Tersinkron when Google's event is tracked and nothing is queued", () => {
    expect(deriveMirrorState("confirmed", TRACKED, null)).toBe("synced");
    expect(MIRROR_STATE_LABEL.synced).toBe("Tersinkron");
  });

  it("shows Menunggu while an intent is open without an error", () => {
    expect(deriveMirrorState("confirmed", null, work())).toBe("pending");
    expect(MIRROR_STATE_LABEL.pending).toBe("Menunggu");
  });

  it("shows Gagal when the last attempt recorded an error", () => {
    expect(
      deriveMirrorState("confirmed", null, work({ last_error: "Google down" })),
    ).toBe("failed");
    expect(MIRROR_STATE_LABEL.failed).toBe("Gagal");
  });

  it("still shows Gagal while a tracked event exists but removal failed", () => {
    expect(
      deriveMirrorState(
        "cancelled",
        TRACKED,
        work({ operation: "delete", last_error: "izin ditolak" }),
      ),
    ).toBe("failed");
  });

  it("shows no state for a Booking Google is not meant to have", () => {
    expect(deriveMirrorState("pending", null, null)).toBeNull();
    expect(
      deriveMirrorState("cancelled", null, work({ operation: "delete" })),
    ).toBeNull();
  });

  it("shows no state when there is neither a tracked event nor an intent", () => {
    // The save enqueues before this can be seen; a badge without evidence
    // would be a guess, so a confirmed row with no mirror rows stays plain.
    expect(deriveMirrorState("confirmed", null, null)).toBeNull();
  });

  it("shows no Tersinkron for a cancelled Booking whose delete never queued", () => {
    expect(deriveMirrorState("cancelled", TRACKED, null)).toBeNull();
  });

  it("ignores a processed queue row", () => {
    expect(
      deriveMirrorState(
        "confirmed",
        TRACKED,
        work({ processed_at: "2026-10-22T02:00:00.000Z", last_error: "lama" }),
      ),
    ).toBe("synced");
  });
});

describe("indexMirrorStates", () => {
  it("maps every Booking to its derived state and ignores orphans", () => {
    const rows = [booking("b1", "confirmed"), booking("b2", "pending")];
    const states = indexMirrorStates(
      rows,
      [TRACKED, { ...TRACKED, booking_id: "gone", google_event_id: "g2" }],
      [work({ booking_id: "b2", operation: "delete" })],
    );
    expect(states.get("b1")).toBe("synced");
    expect(states.get("b2")).toBeNull();
    expect(states.has("gone")).toBe(false);
  });
});
