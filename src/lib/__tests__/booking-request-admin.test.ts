import { describe, expect, it } from "vitest";
import {
  buildFormatBookingLink,
  deriveBookingRequestState,
  remainingBalance,
  requestToBookingDraft,
  suggestTotal,
} from "../admin/booking-request";
import type { BookingRequest } from "../supabase/database";

// Seam 1 (pure): admin Booking Request helpers — derived state, link
// building, request→booking draft, total suggestion, remaining balance.
// Catches wrong state precedence, a leaked price/status on the draft, and
// a stored-instead-of-derived settlement. Misses live DB/RLS behavior.

const NOW = new Date("2026-10-18T12:00:00.000Z");

const REQUEST: BookingRequest = {
  id: "req-1",
  token: "tok-1",
  created_at: "2026-10-15T00:00:00.000Z",
  expires_at: "2026-10-22T00:00:00.000Z",
  submitted_at: null,
  accepted_booking_id: null,
  client_name: "",
  client_phone: "",
  event_type: "",
  headcount: 1,
  venue: "",
  hairdo: "",
  notes: "",
  date: null,
  start_time: null,
  end_time: null,
};

describe("deriveBookingRequestState", () => {
  it("is open when not submitted, not accepted, and not yet expired", () => {
    expect(deriveBookingRequestState(REQUEST, NOW)).toBe("open");
  });

  it("is submitted once the client has submitted and the link is live", () => {
    expect(
      deriveBookingRequestState(
        { ...REQUEST, submitted_at: "2026-10-17T09:00:00.000Z" },
        NOW,
      ),
    ).toBe("submitted");
  });

  it("is expired when the deadline has passed and nothing was submitted", () => {
    expect(
      deriveBookingRequestState(
        { ...REQUEST, expires_at: "2026-10-18T11:59:59.000Z" },
        NOW,
      ),
    ).toBe("expired");
  });

  it("treats the exact expiry instant as expired", () => {
    expect(
      deriveBookingRequestState(
        { ...REQUEST, expires_at: "2026-10-18T12:00:00.000Z" },
        NOW,
      ),
    ).toBe("expired");
  });

  it("is accepted whenever a booking is linked, outranking every other state", () => {
    expect(
      deriveBookingRequestState(
        {
          ...REQUEST,
          submitted_at: "2026-10-17T09:00:00.000Z",
          accepted_booking_id: "booking-9",
          expires_at: "2026-01-01T00:00:00.000Z",
        },
        NOW,
      ),
    ).toBe("accepted");
  });
});

describe("buildFormatBookingLink", () => {
  it("joins the base URL and token as /request/<token>", () => {
    expect(buildFormatBookingLink("https://mua.example.com", "abc123")).toBe(
      "https://mua.example.com/request/abc123",
    );
  });

  it("drops a trailing slash on the base URL", () => {
    expect(buildFormatBookingLink("https://mua.example.com/", "abc123")).toBe(
      "https://mua.example.com/request/abc123",
    );
  });
});

describe("requestToBookingDraft", () => {
  it("maps the client/event fields and leaves service, notes, price, DP, status to the admin", () => {
    const draft = requestToBookingDraft({
      ...REQUEST,
      client_name: "Sinta",
      client_phone: "081234567890",
      event_type: "Wisuda",
      headcount: 3,
      venue: "Gedung A",
      hairdo: "Sanggul",
      date: "2026-11-01",
      start_time: "09:00",
      end_time: "11:00",
      notes: "Punya catatan",
    });
    expect(draft).toEqual({
      client_name: "Sinta",
      client_phone: "081234567890",
      event_type: "Wisuda",
      headcount: 3,
      venue: "Gedung A",
      hairdo: "Sanggul",
      date: "2026-11-01",
      start_time: "09:00",
      end_time: "11:00",
      service_id: null,
      notes: "",
      total_price: null,
      dp_amount: 0,
      status: "pending",
    });
  });

  it("maps an absent requested slot to empty strings so the form defaults stand", () => {
    const draft = requestToBookingDraft(REQUEST);
    expect(draft.date).toBe("");
    expect(draft.start_time).toBe("");
    expect(draft.end_time).toBe("");
  });
});

describe("suggestTotal", () => {
  it("multiplies the service price by headcount", () => {
    expect(suggestTotal(150000, 3)).toBe(450000);
  });

  it("returns null when no service price is known", () => {
    expect(suggestTotal(null, 3)).toBeNull();
  });

  it("returns null for a non-positive or fractional headcount", () => {
    expect(suggestTotal(150000, 0)).toBeNull();
    expect(suggestTotal(150000, 2.5)).toBeNull();
  });
});

describe("remainingBalance", () => {
  it("subtracts the down payment from the total", () => {
    expect(remainingBalance(450000, 100000)).toBe(350000);
  });

  it("returns null when no total has been set", () => {
    expect(remainingBalance(null, 100000)).toBeNull();
  });

  it("returns the total when nothing has been paid", () => {
    expect(remainingBalance(450000, 0)).toBe(450000);
  });
});
