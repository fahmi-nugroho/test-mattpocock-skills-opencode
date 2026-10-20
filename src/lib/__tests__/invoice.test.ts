import { describe, expect, it } from "vitest";
import {
  buildInvoiceSnapshot,
  formatInvoiceNumber,
  indexInvoicesByBooking,
  invoiceDateEditRefusal,
  invoiceIsSent,
  invoiceIssueRefusal,
  invoiceSentLabel,
  invoiceSnapshotOf,
  invoiceYear,
  paymentPosition,
  sortInvoicesNewestFirst,
} from "../admin/invoice";
import type { Booking, Invoice } from "../supabase/database";

// Seam 1 (pure): the invoice number's `invc-NN/YYYY` shape and the derived
// payment position. Catches a number whose year does not come from the issue
// date and a balance/status that disagrees with subtotal − DP.
// Misses DB uniqueness and allocation (0018) and the screen wiring.
describe("invoice number", () => {
  it("formats one business-wide series as invc-NN/YYYY", () => {
    expect(formatInvoiceNumber(1, "2026-10-20")).toBe("invc-01/2026");
    expect(formatInvoiceNumber(12, "2026-03-01")).toBe("invc-12/2026");
    expect(formatInvoiceNumber(100, "2026-03-01")).toBe("invc-100/2026");
  });

  it("reads the year from the issue date, not from today or the booking", () => {
    expect(invoiceYear("2027-01-01")).toBe(2027);
    expect(formatInvoiceNumber(1, "2026-12-31")).toBe("invc-01/2026");
    expect(formatInvoiceNumber(1, "2027-01-01")).toBe("invc-01/2027");
  });

  it("rejects a sequence that could not belong to the series", () => {
    expect(() => formatInvoiceNumber(0, "2026-10-20")).toThrow();
    expect(() => formatInvoiceNumber(1.5, "2026-10-20")).toThrow();
    expect(() => formatInvoiceNumber(1, "20 Oktober 2026")).toThrow();
  });
});

describe("payment position", () => {
  it("derives the remaining balance as subtotal minus the DP", () => {
    expect(paymentPosition(1_500_000, 500_000)).toEqual({
      remaining: 1_000_000,
      status: "DP diterima",
    });
  });

  it("is Lunas once the DP reaches the subtotal", () => {
    expect(paymentPosition(1_500_000, 1_500_000)).toEqual({
      remaining: 0,
      status: "Lunas",
    });
    expect(paymentPosition(1_500_000, 1_600_000)).toEqual({
      remaining: -100_000,
      status: "Lunas",
    });
  });

  it("keeps the balance subtotal minus DP even when nothing is paid", () => {
    expect(paymentPosition(800_000, 0)).toEqual({
      remaining: 800_000,
      status: "DP diterima",
    });
  });
});

const BOOKING: Booking = {
  id: "b1",
  date: "2026-11-14",
  start_time: "08:00",
  end_time: "12:00",
  service_id: "s1",
  client_name: "Sari",
  client_phone: "081234567890",
  notes: "",
  status: "confirmed",
  event_type: "Wisuda",
  headcount: 2,
  venue: "Gedung A",
  hairdo: "hijabdo",
  reference: "",
  total_price: 1_500_000,
  dp_amount: 500_000,
};

const NEWEST: Invoice = {
  id: "i1",
  created_at: "2026-10-20T08:00:00.000Z",
  booking_id: "b1",
  year: 2026,
  seq: 7,
  number: "invc-07/2026",
  issued_on: "2026-10-20",
  due_on: "2026-11-14",
  sent_at: null,
  client_name: "Sari",
  client_phone: "081234567890",
  service_name: "Makeup Wisuda",
  event_type: "Wisuda",
  headcount: 2,
  venue: "Gedung A",
  hairdo: "hijabdo",
  booking_date: "2026-11-14",
  start_time: "08:00",
  end_time: "12:00",
  subtotal: 1_500_000,
  dp_amount: 500_000,
};

function issue(
  overrides: Partial<Booking> = {},
  dates: { issuedOn: string; dueOn: string } = {
    issuedOn: "2026-10-20",
    dueOn: "2026-11-14",
  },
) {
  return {
    booking: { ...BOOKING, ...overrides },
    serviceName: "Makeup Wisuda",
    issuedOn: dates.issuedOn,
    dueOn: dates.dueOn,
  };
}

// Seam 1 (pure): the UI's issuing guard. Catches a dialog that would let the
// database refuse an obvious case after a click, and the duplicate-number trap
// the database cannot see because it has no "newest invoice" in view.
// Misses live RLS and allocation races (0018).
describe("invoice issuing guard", () => {
  it("accepts a confirmed Booking with a total, a DP and valid dates", () => {
    expect(invoiceIssueRefusal(issue(), null)).toBeNull();
  });

  it("refuses a cancelled Booking with an Indonesian reason", () => {
    expect(invoiceIssueRefusal(issue({ status: "cancelled" }), null)).toMatch(
      /dibatalkan/i,
    );
  });

  it("refuses a Booking without an agreed total", () => {
    expect(invoiceIssueRefusal(issue({ total_price: null }), null)).toMatch(
      /total yang disepakati/i,
    );
  });

  it("refuses a Booking without a recorded DP", () => {
    expect(invoiceIssueRefusal(issue({ dp_amount: 0 }), null)).toMatch(
      /dp yang tercatat/i,
    );
  });

  it("refuses a DP above the agreed total", () => {
    expect(
      invoiceIssueRefusal(issue({ dp_amount: 1_600_000 }), null),
    ).toMatch(/melebihi total/i);
  });

  it("refuses a due date before the issue date", () => {
    expect(
      invoiceIssueRefusal(
        issue({}, { issuedOn: "2026-11-14", dueOn: "2026-11-13" }),
        null,
      ),
    ).toMatch(/jatuh tempo.*sebelum tanggal terbit/i);
  });

  it("refuses an Invoice identical to the newest one and points at resending it", () => {
    const refusal = invoiceIssueRefusal(issue(), NEWEST);
    expect(refusal).toMatch(/invc-07\/2026/);
    expect(refusal).toMatch(/kirim ulang/i);
  });

  it("allows a changed Booking detail to become a new Invoice", () => {
    expect(invoiceIssueRefusal(issue({ client_name: "Sari Dewi" }), NEWEST)).toBeNull();
    expect(
      invoiceIssueRefusal(issue({ dp_amount: 1_500_000 }), NEWEST),
    ).toBeNull();
  });

  it("allows a different due date to become a new Invoice", () => {
    expect(
      invoiceIssueRefusal(
        issue({}, { issuedOn: "2026-10-20", dueOn: "2026-11-01" }),
        NEWEST,
      ),
    ).toBeNull();
  });
});

// Seam 1 (pure): the date-edit guard on an unsent Invoice. Catches a screen
// that lets the issue date leave the number's year or accepts a due date
// before the issue date, and a sent Invoice that still offers editing.
// Misses the table CHECKs and the freeze trigger (0018/0019).
describe("invoice date editing guard", () => {
  it("accepts both dates while the Invoice is unsent and the year holds", () => {
    expect(
      invoiceDateEditRefusal(NEWEST, {
        issuedOn: "2026-01-02",
        dueOn: "2026-01-31",
      }),
    ).toBeNull();
  });

  it("refuses any date edit once the Invoice has been sent", () => {
    expect(
      invoiceDateEditRefusal(
        { ...NEWEST, sent_at: "2026-10-20T09:00:00.000Z" },
        { issuedOn: "2026-10-21", dueOn: "2026-11-14" },
      ),
    ).toMatch(/sudah dikirim/i);
  });

  it("refuses an issue date outside the number's year", () => {
    expect(
      invoiceDateEditRefusal(NEWEST, {
        issuedOn: "2027-01-02",
        dueOn: "2027-01-31",
      }),
    ).toMatch(/tahun 2026/i);
  });

  it("still refuses a due date before the issue date", () => {
    expect(
      invoiceDateEditRefusal(NEWEST, {
        issuedOn: "2026-10-20",
        dueOn: "2026-10-19",
      }),
    ).toMatch(/jatuh tempo.*sebelum tanggal terbit/i);
  });
});

describe("invoice list helpers", () => {
  it("sorts every Invoice newest first by year then sequence", () => {
    const olderYear = { ...NEWEST, id: "i0", year: 2025, seq: 9 };
    const olderSeq = { ...NEWEST, id: "i2", seq: 6 };
    const newerSeq = { ...NEWEST, id: "i3", seq: 8 };

    expect(
      sortInvoicesNewestFirst([olderSeq, olderYear, newerSeq]).map(
        (invoice) => invoice.id,
      ),
    ).toEqual(["i3", "i2", "i0"]);
  });

  it("groups a Booking's Invoices without mutating the rows it is given", () => {
    const otherBooking = {
      ...NEWEST,
      id: "other",
      booking_id: "b2",
      seq: 3,
    };
    const rows = [NEWEST, otherBooking];
    const grouped = indexInvoicesByBooking(rows);

    expect(grouped.get("b1")?.map((invoice) => invoice.id)).toEqual(["i1"]);
    expect(grouped.get("b2")?.map((invoice) => invoice.id)).toEqual(["other"]);
    expect(rows.map((invoice) => invoice.id)).toEqual(["i1", "other"]);
  });

  it("names the two sent states the list and the row print", () => {
    expect(invoiceIsSent(NEWEST)).toBe(false);
    expect(invoiceSentLabel(NEWEST)).toBe("Belum dikirim");
    expect(
      invoiceSentLabel({ ...NEWEST, sent_at: "2026-10-20T09:00:00.000Z" }),
    ).toBe("Terkirim");
  });
});

describe("invoice snapshot", () => {
  it("copies the Booking's displayed fields and both dates", () => {
    expect(
      buildInvoiceSnapshot(BOOKING, "Makeup Wisuda", "2026-10-20", "2026-11-14"),
    ).toEqual({
      client_name: "Sari",
      client_phone: "081234567890",
      service_name: "Makeup Wisuda",
      event_type: "Wisuda",
      headcount: 2,
      venue: "Gedung A",
      hairdo: "hijabdo",
      booking_date: "2026-11-14",
      start_time: "08:00",
      end_time: "12:00",
      subtotal: 1_500_000,
      dp_amount: 500_000,
      issued_on: "2026-10-20",
      due_on: "2026-11-14",
    });
  });

  it("reads a saved Invoice's snapshot from the Invoice row, never a live Booking", () => {
    expect(invoiceSnapshotOf(NEWEST)).toEqual({
      client_name: "Sari",
      client_phone: "081234567890",
      service_name: "Makeup Wisuda",
      event_type: "Wisuda",
      headcount: 2,
      venue: "Gedung A",
      hairdo: "hijabdo",
      booking_date: "2026-11-14",
      start_time: "08:00",
      end_time: "12:00",
      subtotal: 1_500_000,
      dp_amount: 500_000,
      issued_on: "2026-10-20",
      due_on: "2026-11-14",
    });
  });

  it("keeps showing the saved Invoice after its Booking is edited", () => {
    const before = invoiceSnapshotOf(NEWEST);
    const editedBooking = {
      ...BOOKING,
      client_name: "Sari Dewi",
      date: "2026-12-01",
      start_time: "09:00",
      end_time: "13:00",
      venue: "Gedung B",
      total_price: 1_750_000,
      dp_amount: 750_000,
    };
    const prospective = buildInvoiceSnapshot(
      editedBooking,
      "Makeup Wisuda",
      "2026-10-20",
      "2026-12-01",
    );

    expect(prospective).not.toEqual(before);
    expect(invoiceSnapshotOf(NEWEST)).toEqual(before);
  });
});
