import { describe, expect, it } from "vitest";
import {
  INVOICE_PAGE,
  layoutInvoice,
  type InvoiceDrawOp,
  type InvoiceMeasure,
  type InvoiceTextOp,
} from "../admin/invoice-layout";
import { invoiceBusiness, type InvoiceBusiness } from "../admin/invoice";
import { formatDateIdLong } from "../format";
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
      expect(op.x).toBe(INVOICE_PAGE.width - INVOICE_PAGE.margin);
    }
    expect(
      texts(ops).find((op) => op.text === "TOTAL" && op.x === 500),
    ).toMatchObject({ align: "left" });
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

  it("keeps the item's Headcount and total columns apart", () => {
    const ops = layout();
    const headcount = texts(ops).find((op) => op.text === "2 orang");
    const total = texts(ops).find(
      (op) => op.text === "Rp 1.500.000" && op.y === headcount?.y,
    );
    expect(headcount && total).toBeTruthy();
    if (!headcount || !total) return;
    expect(total.x - measure(total.text, total)).toBeGreaterThan(headcount.x);
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
      "SISA PEMBAYARAN",
      "DP DITERIMA",
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

  it("prints the invoice number, Indonesian issue/due dates and the client", () => {
    const values = strings(layout());
    expect(values).toContain("No:");
    expect(values).toContain("invc-07/2026");
    expect(values).toContain("Tanggal:");
    expect(values).toContain("20 Oktober 2026");
    expect(values).toContain("Jatuh Tempo:");
    expect(values).toContain("14 November 2026");
    expect(values).toContain("Kepada:");
    expect(values).toContain("Sari Dewi");
    expect(values).not.toContain("Selasa, 20 Oktober 2026");
    expect(values.join(" ")).not.toMatch(/October/);
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
  });

  it("shows the Headcount and one agreed total on the item row, no QTY or PRICE", () => {
    const ops = layout();
    const values = strings(ops);
    const service = texts(ops).find((op) => op.text === "Makeup Wisuda");
    const row = texts(ops).filter((op) => op.y === service?.y);
    expect(row.map((op) => op.text)).toEqual([
      "Makeup Wisuda",
      "2 orang",
      "Rp 1.500.000",
    ]);
    expect(values).not.toContain("QTY");
    expect(values).not.toContain("PRICE");
    expect(values).not.toContain("1");
  });

  it("prints the agreed total, never price x Headcount", () => {
    const values = strings(layout({ ...INVOICE, headcount: 3 }));
    expect(values).toContain("3 orang");
    expect(values.filter((value) => value === "Rp 1.500.000").length).toBe(2);
    expect(values).not.toContain("Rp 4.500.000");
  });

  it("prints the total, DP and a gold SISA PEMBAYARAN larger than the other money rows", () => {
    const ops = layout();
    const values = strings(ops);
    expect(values).toContain("DP");
    expect(values).toContain("Rp 500.000");
    expect(values).not.toContain("SUBTOTAL");
    expect(values).not.toContain("PELUNASAN");
    const label = texts(ops).find((op) => op.text === "SISA PEMBAYARAN");
    const amount = texts(ops).find((op) => op.text === "Rp 1.000.000");
    const dp = texts(ops).find((op) => op.text === "DP");
    expect(label && amount && dp).toBeTruthy();
    if (!label || !amount || !dp) return;
    for (const op of [label, amount]) {
      expect(op.color).toBe("#8a5a2b");
      expect(op.size).toBeGreaterThan(dp.size);
    }
    expect(amount.size).toBeGreaterThan(label.size);
  });

  it("badges a DP diterima Invoice as DP DITERIMA, beside a balance still owed", () => {
    const ops = layout();
    const values = strings(ops);
    expect(values).toContain("DP DITERIMA");
    expect(values).not.toContain("LUNAS");
    expect(values).toContain("Rp 1.000.000");
    const badge = texts(ops).find((op) => op.text === "DP DITERIMA");
    const fill = ops.find(
      (op) => op.kind === "fill" && op.y > 0 && op.height < 100,
    );
    expect(badge && fill?.kind === "fill").toBe(true);
    if (!badge || fill?.kind !== "fill") return;
    expect(badge.x).toBeLessThanOrEqual(fill.x + fill.width);
    expect(badge.x - measure(badge.text, badge)).toBeGreaterThanOrEqual(fill.x);
    expect(badge.y).toBeGreaterThan(fill.y);
    expect(badge.y).toBeLessThanOrEqual(fill.y + fill.height);
  });

  it("badges a settled Invoice as LUNAS with nothing left to pay", () => {
    const settled = { ...INVOICE, dp_amount: INVOICE.subtotal };
    const values = strings(layout(settled));
    expect(values).toContain("LUNAS");
    expect(values).not.toContain("DP DITERIMA");
    expect(values).toContain("Rp 0");
  });

  it("never prints a negative balance for an overpaid Invoice", () => {
    const overpaid = { ...INVOICE, dp_amount: INVOICE.subtotal + 100_000 };
    const values = strings(layout(overpaid));
    expect(values).toContain("LUNAS");
    expect(values).toContain("Rp 0");
    expect(values.join(" ")).not.toMatch(/Rp -/);
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
    expect(values).toContain("Informasi Pembayaran");
    expect(values).toContain("Bank:");
    expect(values).toContain("BCA");
    expect(values).toContain("Nama Rekening:");
    expect(values).toContain("Wandana");
    expect(values).toContain("Nomor Rekening:");
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
    expect(values).toContain("Informasi Pembayaran");
    expect(values).toContain("Bank:");
    expect(values).toContain("Nama Rekening:");
    expect(values).toContain("Nomor Rekening:");
    expect(values.filter((value) => value === "—").length).toBeGreaterThanOrEqual(3);
  });
});

describe("invoice Format Order block", () => {
  it("prints the Indonesian event date and every booking detail", () => {
    const values = strings(layout());
    expect(values).toContain("Detail Pesanan");
    expect(values).toContain("Tanggal Acara:");
    expect(values).toContain("Sabtu, 14 November 2026");
    expect(values).toContain("Jenis Acara:");
    expect(values).toContain("Wisuda");
    expect(values).toContain("Jumlah Orang:");
    expect(values).toContain("2 orang");
    expect(values).toContain("Gaya:");
    expect(values).toContain("Hijabdo");
    expect(values).toContain("Lokasi:");
    expect(values).toContain("Gedung Serbaguna");
    expect(values).toContain("No. Telepon:");
    expect(values).toContain("081234567890");
    expect(values).toContain("Jam Mulai:");
    expect(values).toContain("08:00");
    expect(values).toContain("Jam Selesai:");
    expect(values).toContain("12:00");
    expect(values).not.toContain("hijabdo");
  });

  it("prints no English label anywhere on the picture", () => {
    const values = strings(layout());
    for (const english of [
      "Date:",
      "Due Date:",
      "To:",
      "Event Date:",
      "Event Type:",
      "Headcount:",
      "Hairdo:",
      "Venue:",
      "Client Phone:",
      "Start Time:",
      "Finish Time:",
      "Account Name:",
      "Account Number:",
      "Payment Information",
      "Format Order",
      "Thank You",
    ]) {
      expect(values).not.toContain(english);
    }
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
      (op) => op.text !== "Lokasi:" && venue.includes(op.text) && op.x > 200,
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

  it("ends with the script Terima kasih, centred above the bottom margin", () => {
    const ops = layout();
    const last = texts(ops).at(-1);
    expect(last?.text).toBe("Terima kasih");
    expect(last).toMatchObject({ font: "script", x: 450, align: "center" });
    expect(last?.y).toBeLessThan(1600);
  });

  it("formats an Indonesian long date without a weekday", () => {
    expect(formatDateIdLong("2026-10-21")).toBe("21 Oktober 2026");
    expect(formatDateIdLong("2027-01-01")).toBe("1 Januari 2027");
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
