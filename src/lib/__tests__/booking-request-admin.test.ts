import { describe, expect, it } from "vitest";
import {
  BOOKING_REQUEST_CORRECT_NOTICE,
  BOOKING_REQUEST_DELETE_WARNING,
  BOOKING_REQUEST_FILTERS,
  BOOKING_REQUEST_FILTER_LABEL,
  BOOKING_REQUEST_REISSUE_NOTICE,
  BOOKING_REQUEST_STATUS_LABEL,
  bookingRequestCanReissue,
  bookingRequestCorrectRefusal,
  bookingRequestDeleteRefusal,
  bookingRequestRefusalHint,
  buildFormatBookingLink,
  correctRefusalMessage,
  deleteRefusalMessage,
  deriveBookingRequestState,
  filterBookingRequests,
  refusalMessage,
  remainingBalance,
  requestToBookingDraft,
  requestToReissuePrefill,
  suggestTotal,
} from "../admin/booking-request";
import type { BookingRequest } from "../supabase/database";

// Seam 1 (pure): admin Booking Request helpers — derived state, state filter,
// link building, request→booking draft, re-issue prefill, and the status /
// correct / delete / re-issue copy. Catches wrong state precedence, a leaked
// field on a draft or re-issue prefill, and a stored-instead-of-derived
// settlement. Misses live DB/RLS behavior.

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
  reference: "",
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

  it("reads expired for a submitted request whose link has since expired", () => {
    expect(
      deriveBookingRequestState(
        {
          ...REQUEST,
          submitted_at: "2026-10-17T09:00:00.000Z",
          expires_at: "2026-10-18T11:59:59.000Z",
        },
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

describe("filterBookingRequests", () => {
  const OPEN = { ...REQUEST, id: "req-open" };
  const SUBMITTED = {
    ...REQUEST,
    id: "req-submitted",
    submitted_at: "2026-10-17T09:00:00.000Z",
  };
  const ACCEPTED = {
    ...REQUEST,
    id: "req-accepted",
    accepted_booking_id: "booking-9",
    expires_at: "2026-10-01T00:00:00.000Z",
  };
  const LAPSED = {
    ...REQUEST,
    id: "req-lapsed",
    expires_at: "2026-10-18T11:59:59.000Z",
  };
  const ANSWERED_LATE = {
    ...REQUEST,
    id: "req-answered-late",
    submitted_at: "2026-10-17T09:00:00.000Z",
    expires_at: "2026-10-18T11:59:59.000Z",
  };
  const ALL = [OPEN, SUBMITTED, ACCEPTED, LAPSED, ANSWERED_LATE];

  it("names the filter vocabulary all, needs action, open, accepted, lapsed", () => {
    expect(BOOKING_REQUEST_FILTERS).toEqual([
      "all",
      "needs_action",
      "open",
      "accepted",
      "lapsed",
    ]);
  });

  it("returns every request for the show-everything filter", () => {
    expect(filterBookingRequests(ALL, "all", NOW)).toEqual(ALL);
  });

  it("narrows to the requests needing action (still submitted, not lapsed)", () => {
    expect(filterBookingRequests(ALL, "needs_action", NOW)).toEqual([SUBMITTED]);
  });

  it("narrows to the open links still waiting on the client", () => {
    expect(filterBookingRequests(ALL, "open", NOW)).toEqual([OPEN]);
  });

  it("narrows to the requests already turned into a booking", () => {
    expect(filterBookingRequests(ALL, "accepted", NOW)).toEqual([ACCEPTED]);
  });

  it("narrows to the lapsed links", () => {
    expect(filterBookingRequests(ALL, "lapsed", NOW)).toEqual([
      LAPSED,
      ANSWERED_LATE,
    ]);
  });

  it("reads a request answered before its window lapsed as lapsed, matching the derivation", () => {
    expect(deriveBookingRequestState(ANSWERED_LATE, NOW)).toBe("expired");
    expect(filterBookingRequests([ANSWERED_LATE], "lapsed", NOW)).toEqual([
      ANSWERED_LATE,
    ]);
  });

  it("treats an accepted request as accepted even when its link has lapsed", () => {
    expect(filterBookingRequests([ACCEPTED], "lapsed", NOW)).toEqual([]);
    expect(filterBookingRequests([ACCEPTED], "accepted", NOW)).toEqual([
      ACCEPTED,
    ]);
  });

  it("derives each request with the injected clock, not the wall clock", () => {
    const beforeExpiry = new Date("2026-10-18T11:00:00.000Z");
    expect(filterBookingRequests([ANSWERED_LATE], "lapsed", beforeExpiry)).toEqual(
      [],
    );
    expect(
      filterBookingRequests([ANSWERED_LATE], "needs_action", beforeExpiry),
    ).toEqual([ANSWERED_LATE]);
  });

  it("labels each chip so the badge story cannot differ from the chip story", () => {
    expect(BOOKING_REQUEST_FILTER_LABEL).toEqual({
      all: "Semua",
      needs_action: "Perlu ditindak",
      open: "Terbuka",
      accepted: "Diterima",
      lapsed: "Kedaluwarsa",
    });
    // The state chips are literally the row-badge labels, so a chip and the
    // badge cannot drift apart.
    expect(BOOKING_REQUEST_FILTER_LABEL.open).toBe(
      BOOKING_REQUEST_STATUS_LABEL.open,
    );
    expect(BOOKING_REQUEST_FILTER_LABEL.accepted).toBe(
      BOOKING_REQUEST_STATUS_LABEL.accepted,
    );
    expect(BOOKING_REQUEST_FILTER_LABEL.lapsed).toBe(
      BOOKING_REQUEST_STATUS_LABEL.expired,
    );
  });
});

describe("status copy (single home)", () => {
  it("labels every derived state in Indonesian", () => {
    expect(BOOKING_REQUEST_STATUS_LABEL).toEqual({
      open: "Terbuka",
      submitted: "Terkirim",
      accepted: "Diterima",
      expired: "Kedaluwarsa",
    });
  });

  it("hints why a non-submitted request cannot be accepted, in Indonesian", () => {
    expect(bookingRequestRefusalHint("open")).toMatch(/menunggu klien/i);
    expect(bookingRequestRefusalHint("expired")).toMatch(/kedaluwarsa/i);
    expect(bookingRequestRefusalHint("accepted")).toMatch(/sudah diterima/i);
  });

  it("explains an accept refusal for each state, in Indonesian", () => {
    expect(refusalMessage("accepted")).toMatch(/sudah diterima/i);
    expect(refusalMessage("expired")).toMatch(/kedaluwarsa/i);
    expect(refusalMessage("submitted")).toMatch(/muat ulang|tidak bisa diterima/i);
    expect(refusalMessage("open")).toMatch(/belum dikirim/i);
  });
});

describe("delete copy (single home)", () => {
  it("allows delete for every state except an accepted one", () => {
    expect(bookingRequestDeleteRefusal("open")).toBeNull();
    expect(bookingRequestDeleteRefusal("submitted")).toBeNull();
    expect(bookingRequestDeleteRefusal("expired")).toBeNull();
    expect(bookingRequestDeleteRefusal("accepted")).toMatch(/hapus booking/i);
  });

  it("explains a delete refusal in Indonesian, pointing at the Booking", () => {
    expect(deleteRefusalMessage("accepted")).toMatch(/hapus booking/i);
    expect(deleteRefusalMessage("open")).toMatch(/muat ulang/i);
  });

  it("warns before the second click that deleting kills the client's link", () => {
    expect(BOOKING_REQUEST_DELETE_WARNING).toMatch(/link/i);
    expect(BOOKING_REQUEST_DELETE_WARNING).toMatch(/klien/i);
  });
});

describe("correct copy (single home)", () => {
  it("allows correcting only while the request is open", () => {
    expect(bookingRequestCorrectRefusal("open")).toBeNull();
    expect(bookingRequestCorrectRefusal("submitted")).toMatch(
      /klien sudah mengirim/i,
    );
    expect(bookingRequestCorrectRefusal("accepted")).toMatch(/sudah diterima/i);
    expect(bookingRequestCorrectRefusal("expired")).toMatch(/kedaluwarsa/i);
  });

  it("explains a correction refusal in Indonesian, and reads a non-open read-back as a lost race", () => {
    expect(correctRefusalMessage("submitted")).toMatch(/klien sudah mengirim/i);
    expect(correctRefusalMessage("accepted")).toMatch(/sudah diterima/i);
    expect(correctRefusalMessage("expired")).toMatch(/kedaluwarsa/i);
    // The guarded write only matches the open state, so an open read-back means
    // a lost race, not a real refusal.
    expect(correctRefusalMessage("open")).toMatch(/muat ulang/i);
  });

  it("warns that a client who already opened the form may still send the values they loaded", () => {
    expect(BOOKING_REQUEST_CORRECT_NOTICE).toMatch(/membuka form/i);
    expect(BOOKING_REQUEST_CORRECT_NOTICE).toMatch(/lama/i);
  });
});

describe("reissue copy (single home)", () => {
  it("offers a fresh link only for a lapsed request", () => {
    expect(bookingRequestCanReissue("expired")).toBe(true);
    expect(bookingRequestCanReissue("open")).toBe(false);
    expect(bookingRequestCanReissue("submitted")).toBe(false);
    expect(bookingRequestCanReissue("accepted")).toBe(false);
  });

  it("says plainly that the client must fill the form again and that only the name and slot carry over", () => {
    expect(BOOKING_REQUEST_REISSUE_NOTICE).toMatch(/isi ulang|mengisi|form lagi/i);
    expect(BOOKING_REQUEST_REISSUE_NOTICE).toMatch(/nama/i);
    expect(BOOKING_REQUEST_REISSUE_NOTICE).toMatch(/jadwal/i);
  });
});

describe("requestToReissuePrefill", () => {
  it("carries only the client name and the requested slot from the old row", () => {
    const prefill = requestToReissuePrefill({
      ...REQUEST,
      client_name: "Sinta",
      client_phone: "081234567890",
      event_type: "Wisuda",
      headcount: 3,
      venue: "Gedung A",
      hairdo: "hijabdo",
      reference: "https://contoh.test/look",
      notes: "Punya catatan",
      date: "2026-11-01",
      start_time: "09:00",
      end_time: "11:00",
    });
    expect(prefill).toEqual({
      client_name: "Sinta",
      date: "2026-11-01",
      start_time: "09:00",
      end_time: "11:00",
    });
    // Nothing the client sent is carried over: the fresh link starts empty
    // apart from what the admin entered by hand.
    expect(prefill).not.toHaveProperty("client_phone");
    expect(prefill).not.toHaveProperty("event_type");
    expect(prefill).not.toHaveProperty("headcount");
    expect(prefill).not.toHaveProperty("venue");
    expect(prefill).not.toHaveProperty("hairdo");
    expect(prefill).not.toHaveProperty("reference");
    expect(prefill).not.toHaveProperty("notes");
  });

  it("carries an absent requested slot as null so the fresh link stays open", () => {
    expect(requestToReissuePrefill(REQUEST)).toEqual({
      client_name: "",
      date: null,
      start_time: null,
      end_time: null,
    });
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
  it("carries only the fields the booking form consumes", () => {
    const draft = requestToBookingDraft({
      ...REQUEST,
      client_name: "Sinta",
      client_phone: "081234567890",
      event_type: "Wisuda",
      headcount: 3,
      venue: "Gedung A",
      hairdo: "hijabdo",
      reference: "https://contoh.test/look",
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
      hairdo: "hijabdo",
      reference: "https://contoh.test/look",
      date: "2026-11-01",
      start_time: "09:00",
      end_time: "11:00",
    });
    // Money, status, service, and notes stay with the admin: the draft must
    // never carry them, so the form's own defaults stand.
    expect(draft).not.toHaveProperty("service_id");
    expect(draft).not.toHaveProperty("notes");
    expect(draft).not.toHaveProperty("total_price");
    expect(draft).not.toHaveProperty("dp_amount");
    expect(draft).not.toHaveProperty("status");
  });

  it("carries the request's Style and Reference so the admin does not retype them", () => {
    const draft = requestToBookingDraft({
      ...REQUEST,
      hairdo: "hairdo",
      reference: "lihat ini",
    });
    expect(draft.hairdo).toBe("hairdo");
    expect(draft.reference).toBe("lihat ini");
  });

  it("maps an absent requested slot to empty strings and carries an empty Reference through", () => {
    const draft = requestToBookingDraft(REQUEST);
    expect(draft.date).toBe("");
    expect(draft.start_time).toBe("");
    expect(draft.end_time).toBe("");
    expect(draft.reference).toBe("");
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
