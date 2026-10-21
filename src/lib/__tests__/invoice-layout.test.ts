import { describe, expect, it } from "vitest";
import {
  INVOICE_PAGE,
  layoutInvoice,
  type InvoiceDrawOp,
  type InvoiceMeasure,
  type InvoiceTextOp,
} from "../admin/invoice-layout";
import { invoiceBusiness, type InvoiceBusiness } from "../admin/invoice";
import { formatDateEn } from "../format";
import type { Invoice } from "../supabase/database";

// Seam 1 (pure): the saved Invoice snapshot plus the business details become
// an ordered draw list. Catches missing content, wrong currency/date shapes,
// a payment block that disappears when a setting is empty, and text that
// ignores the injected measurement. Misses the canvas pixels and font load,
// which the thin painter owns.

const INVOICE: Invoice = {
  id: "i1",
  created_at: "2026-10-20T08:00:00.000Z",
  booking_id: "b1",
  year: 2026,
  seq: 7,
  number: "invc-07/2026",
  issued_on: "2026-10-20",
  due_on: "2026-11-14",
  sent_at: null,
  client_name: "Sari Dewi",
  client_phone: "081234567890",
  service_name: "Makeup Wisuda",
  event_type: "Wisuda",
  headcount: 2,
  venue: "Gedung Serbaguna",
  hairdo: "hijabdo",
  booking_date: "2026-11-14",
  start_time: "08:00",
  end_time: "12:00",
  subtotal: 1_500_000,
  dp_amount: 500_000,
};

const BUSINESS: InvoiceBusiness = {
  name: "Wandana Makeup",
  whatsapp: "6281234567890",
  instagram: "wandanamakeup",
  bank: {
    name: "BCA",
    accountName: "Wandana",
    accountNumber: "1234567890",
  },
};

/** Deterministic, independent of any canvas: 0.6 em per character. */
const measure: InvoiceMeasure = (text, style) => text.length * style.size * 0.6;

function layout(
  invoice: Invoice = INVOICE,
  business: InvoiceBusiness = BUSINESS,
): InvoiceDrawOp[] {
  return layoutInvoice(invoice, business, measure);
}

function texts(ops: InvoiceDrawOp[]): InvoiceTextOp[] {
  return ops.filter((op): op is InvoiceTextOp => op.kind === "text");
}

function strings(ops: InvoiceDrawOp[]): string[] {
  return texts(ops).map((op) => op.text);
}

function indexOfText(ops: InvoiceDrawOp[], value: string): number {
  return strings(ops).indexOf(value);
}

function expectInsideMargins(ops: InvoiceDrawOp[]): void {
  const left = INVOICE_PAGE.margin;
  const right = INVOICE_PAGE.width - INVOICE_PAGE.margin;
  for (const op of ops) {
    if (op.kind === "fill") continue;
    if (op.kind === "rule") {
      expect(op.x1).toBeGreaterThanOrEqual(left);
      expect(op.x2).toBeLessThanOrEqual(right);
      expect(op.y1).toBeGreaterThan(0);
      expect(op.y2).toBeLessThan(INVOICE_PAGE.height);
      continue;
    }
    const width = measure(op.text, op);
    expect(op.x).toBeGreaterThanOrEqual(left);
    expect(op.x).toBeLessThanOrEqual(right);
    expect(op.y).toBeGreaterThan(0);
    expect(op.y).toBeLessThan(INVOICE_PAGE.height);
    if (op.align === "left") {
      expect(op.x + width).toBeLessThanOrEqual(right + 0.001);
    }
    if (op.align === "right") {
      expect(op.x - width).toBeGreaterThanOrEqual(left - 0.001);
    }
    if (op.align === "center") {
      expect(op.x - width / 2).toBeGreaterThanOrEqual(left - 0.001);
      expect(op.x + width / 2).toBeLessThanOrEqual(right + 0.001);
    }
  }
}

describe("invoice page and margins", () => {
  it("fills a 900x1600 cream page before drawing anything", () => {
    const ops = layout();
    expect(ops[0]).toMatchObject({
      kind: "fill",
      x: 0,
      y: 0,
      width: 900,
      height: 1600,
    });
    expect(INVOICE_PAGE).toEqual({ width: 900, height: 1600, margin: 72 });
  });

  it("keeps every mark inside the page margins", () => {
    expectInsideMargins(layout());
  });

  it("anchors the money column at the right margin and labels at the left", () => {
    const ops = layout();
    const amounts = texts(ops).filter((op) => op.text.startsWith("Rp"));
    expect(amounts.length).toBeGreaterThan(0);
    for (const op of amounts) {
      expect(op.align).toBe("right");
      expect([710, INVOICE_PAGE.width - INVOICE_PAGE.margin]).toContain(op.x);
    }
    expect(texts(ops).find((op) => op.text === "SUBTOTAL")).toMatchObject({
      x: 500,
      align: "left",
    });
    expect(
      texts(ops).find(
        (op) => op.text === "Rp 1.000.000" && op.x === 828,
      ),
    ).toMatchObject({ align: "right" });
    expect(texts(ops).find((op) => op.text === "Bank:")).toMatchObject({
      x: INVOICE_PAGE.margin,
      align: "left",
    });
  });

  it("keeps the item's qty, price and total columns apart", () => {
    const ops = layout();
    const qty = texts(ops).find((op) => op.text === "1");
    const price = texts(ops).find((op) => op.text === "Rp 1.500.000");
    const total = texts(ops).filter((op) => op.text === "Rp 1.500.000")[1];
    expect(qty && price && total).toBeTruthy();
    if (!qty || !price || !total) return;
    expect(price.x - measure(price.text, price)).toBeGreaterThan(qty.x);
    expect(total.x - measure(total.text, total)).toBeGreaterThan(price.x);
  });

  it("draws the header, then the identity, then the item, then money", () => {
    const ops = layout();
    const order = [
      "Wandana Makeup",
      "Instagram @wandanamakeup",
      "No:",
      INVOICE.number,
      "ITEM",
      INVOICE.service_name,
      INVOICE.event_type,
      "SUBTOTAL",
      "PELUNASAN",
      "Payment Status:",
    ].map((value) => indexOfText(ops, value));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

describe("invoice header and identity", () => {
  it("prints the business name, WhatsApp number and Instagram handle", () => {
    const values = strings(layout());
    expect(values).toContain("Wandana Makeup");
    expect(values).toContain("WhatsApp 6281234567890");
    expect(values).toContain("Instagram @wandanamakeup");
    expect(values).toContain("INVOICE");
  });

  it("prints the invoice number, English issue/due dates and the client", () => {
    const values = strings(layout());
    expect(values).toContain("No:");
    expect(values).toContain("invc-07/2026");
    expect(values).toContain("Date:");
    expect(values).toContain("20 October 2026");
    expect(values).toContain("Due Date:");
    expect(values).toContain("14 November 2026");
    expect(values).toContain("To:");
    expect(values).toContain("Sari Dewi");
    expect(values.join(" ")).not.toMatch(/Oktober/);
  });
});

describe("invoice line item and totals", () => {
  it("prints one line item with the event beneath the service", () => {
    const ops = layout();
    const service = indexOfText(ops, "Makeup Wisuda");
    const event = indexOfText(ops, "Wisuda");
    expect(service).toBeGreaterThanOrEqual(0);
    expect(event).toBeGreaterThan(service);
    expect(texts(ops)[event].y).toBeGreaterThan(texts(ops)[service].y);
    expect(strings(ops)).toContain("1");
    expect(strings(ops)).toContain("Rp 1.500.000");
  });

  it("prints SUBTOTAL, DP, PELUNASAN and the stored Payment Status", () => {
    const values = strings(layout());
    expect(values.filter((value) => value === "Rp 1.500.000").length).toBe(3);
    expect(values).toContain("Rp 500.000");
    expect(values).toContain("Rp 1.000.000");
    expect(values).toContain("SUBTOTAL");
    expect(values).toContain("DP");
    expect(values).toContain("PELUNASAN");
    expect(values).toContain("Payment Status:");
    expect(values).toContain("DP diterima");
  });

  it("derives Lunas from the stored snapshot, never from the live Booking", () => {
    const settled = { ...INVOICE, dp_amount: INVOICE.subtotal };
    const values = strings(layout(settled));
    expect(values).toContain("Lunas");
    expect(values).toContain("Rp 0");
    expect(values).not.toContain("DP diterima");
  });

  it("prints the fixed non-refundable note", () => {
    expect(strings(layout())).toContain(
      "The down payment is non-refundable.",
    );
  });

  it("uses one Rp 200.000 shape for every amount", () => {
    const amounts = strings(layout()).filter((value) => value.includes("Rp"));
    expect(amounts.length).toBeGreaterThan(0);
    for (const amount of amounts) {
      expect(amount).toMatch(/^Rp \d{1,3}(\.\d{3})*$/);
      expect(amount).not.toContain("\u00a0");
    }
  });
});

describe("invoice payment block", () => {
  it("prints bank name, account name and account number", () => {
    const values = strings(layout());
    expect(values).toContain("Payment Information");
    expect(values).toContain("Bank:");
    expect(values).toContain("BCA");
    expect(values).toContain("Account Name:");
    expect(values).toContain("Wandana");
    expect(values).toContain("Account Number:");
    expect(values).toContain("1234567890");
  });

  it("prints an em dash for each empty setting and keeps the block", () => {
    const empty: InvoiceBusiness = {
      ...BUSINESS,
      instagram: "",
      bank: { name: "", accountName: "", accountNumber: "" },
    };
    const values = strings(layout(INVOICE, empty));
    expect(values).toContain("Instagram —");
    expect(values).toContain("Payment Information");
    expect(values).toContain("Bank:");
    expect(values).toContain("Account Name:");
    expect(values).toContain("Account Number:");
    expect(values.filter((value) => value === "—").length).toBeGreaterThanOrEqual(3);
  });
});

describe("invoice Format Order block", () => {
  it("prints the Indonesian event date and every booking detail", () => {
    const values = strings(layout());
    expect(values).toContain("Format Order");
    expect(values).toContain("Event Date:");
    expect(values).toContain("Sabtu, 14 November 2026");
    expect(values).toContain("Event Type:");
    expect(values).toContain("Wisuda");
    expect(values).toContain("Headcount:");
    expect(values).toContain("2 orang");
    expect(values).toContain("Hairdo:");
    expect(values).toContain("Hijabdo");
    expect(values).toContain("Venue:");
    expect(values).toContain("Gedung Serbaguna");
    expect(values).toContain("Client Phone:");
    expect(values).toContain("081234567890");
    expect(values).toContain("Start Time:");
    expect(values).toContain("08:00");
    expect(values).toContain("Finish Time:");
    expect(values).toContain("12:00");
    expect(values).not.toContain("hijabdo");
  });
});

describe("invoice wrapping and footer", () => {
  it("wraps a long value inside the page using the injected measurement", () => {
    const venue =
      "Gedung Serbaguna Utama Lantai Dua Ruang Anggrek dekat Pintu Timur Belakang";
    const wrapped = layout({ ...INVOICE, venue });
    const values = strings(wrapped).join(" ").replace(/\s+/g, " ");
    expect(values).toContain(venue);
    const venueOps = texts(wrapped).filter(
      (op) => op.text !== "Venue:" && venue.includes(op.text) && op.x > 200,
    );
    expect(venueOps.length).toBeGreaterThan(1);
    const right = INVOICE_PAGE.width - INVOICE_PAGE.margin;
    for (const op of venueOps) {
      expect(measure(op.text, op)).toBeLessThanOrEqual(right - op.x + 0.001);
    }
    expectInsideMargins(wrapped);
  });

  it("wraps long header, client and payment values too", () => {
    const client =
      "Sari Dewi Kusumawardhani Putri dari Keluarga Besar Soedirman";
    const business: InvoiceBusiness = {
      ...BUSINESS,
      name: "Wandana Makeup Studio dan Akademi Kecantikan",
      instagram: "wandanamakeupstudioakademikecantikandiindonesia",
      bank: {
        ...BUSINESS.bank,
        accountName: "Wandana Makeup Studio Cabang Kota Bandung",
      },
    };
    const wrapped = layout({ ...INVOICE, client_name: client }, business);
    const values = strings(wrapped).join(" ").replace(/\s+/g, " ");
    expect(values).toContain(client);
    expect(values).toContain(business.name);
    expect(values).toContain(business.bank.accountName);
    expectInsideMargins(wrapped);
  });

  it("ends with the script Thank You, centred above the bottom margin", () => {
    const ops = layout();
    const last = texts(ops).at(-1);
    expect(last?.text).toBe("Thank You");
    expect(last).toMatchObject({ font: "script", x: 450, align: "center" });
    expect(last?.y).toBeLessThan(1600);
  });

  it("formats an English invoice date", () => {
    expect(formatDateEn("2026-10-20")).toBe("20 October 2026");
    expect(formatDateEn("2027-01-01")).toBe("1 January 2027");
  });
});

describe("invoice business details", () => {
  it("reads the name and the four printable settings", () => {
    expect(
      invoiceBusiness({
        wa_number: "6281234567890",
        instagram_handle: "wandanamakeup",
        bank_name: "BCA",
        account_name: "Wandana",
        account_number: "1234567890",
      }),
    ).toEqual(BUSINESS);
  });

  it("keeps a missing settings row printable with empty fields", () => {
    expect(invoiceBusiness(null)).toEqual({
      name: "Wandana Makeup",
      whatsapp: "",
      instagram: "",
      bank: { name: "", accountName: "", accountNumber: "" },
    });
  });
});
