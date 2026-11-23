/**
 * The Invoice picture's pure layout (invoice-and-booking-filter ticket 04).
 *
 * Given the saved Invoice snapshot, the business details and an injected
 * text-measurement function, this returns the ordered draw operations for one
 * 900-wide cream page and the height it needs (at least 1600). It never
 * touches a canvas: the painter just executes the list, so every content,
 * order, margin, alignment and wrapping decision can be tested without
 * pixels.
 *
 * The saved snapshot is the only source of client, event and money values;
 * the live Booking is never read here. Business identity and payment settings
 * arrive separately, and an empty setting becomes an em dash so its block
 * never disappears.
 */

import { formatDateId, formatDateIdLong, formatIDR } from "../format";
import { normaliseInstagramHandle } from "../instagram";
import { isStyle, STYLE_COPY } from "../style-reference";
import type { Invoice } from "../supabase/database";
import { paymentPosition, type InvoiceBusiness } from "./invoice";

export const INVOICE_PAGE = {
  width: 900,
  /** A short Invoice is exactly this tall; longer content grows the page. */
  minHeight: 1600,
  margin: 72,
} as const;

/** Space kept below the thank-you baseline, so the footer is never cropped. */
const FOOTER_BOTTOM = 88;
/** Space between the last content row and the thank-you baseline. */
const FOOTER_GAP = 80;

const LEFT = INVOICE_PAGE.margin;
const RIGHT = INVOICE_PAGE.width - INVOICE_PAGE.margin;
const CONTENT_WIDTH = RIGHT - LEFT;
const VALUE_X = 240;
const MONEY_LABEL_X = 500;
const EM_DASH = "—";

const PAPER = "#fbf6ec";
const INK = "#2e2620";
const MUTED = "#756553";
const RULE = "#c9b79a";
const GOLD = "#8a5a2b";
const STAMP_RED = "#a92d24";

export type InvoiceFont = "body" | "display" | "script";
export type InvoiceTextAlign = "left" | "center" | "right";

export interface InvoiceTextStyle {
  font: InvoiceFont;
  size: number;
  weight: 400 | 700;
  italic: boolean;
  color: string;
}

export interface InvoiceTextOp extends InvoiceTextStyle {
  kind: "text";
  text: string;
  x: number;
  y: number;
  align: InvoiceTextAlign;
  rotation?: number;
}

export interface InvoiceRuleOp {
  kind: "rule";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  color: string;
}

export interface InvoiceFillOp {
  kind: "fill";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export type InvoiceDrawOp = InvoiceTextOp | InvoiceRuleOp | InvoiceFillOp;

/** The draw list plus the page height it needs, so painter and layout agree. */
export interface InvoiceLayout {
  height: number;
  ops: InvoiceDrawOp[];
}

/** Measures one run of text in the same style the painter will draw it. */
export type InvoiceMeasure = (text: string, style: InvoiceTextStyle) => number;

/** The existing IDR formatter, normalised to one `Rp 200.000` shape. */
function invoiceAmount(value: number): string {
  return formatIDR(value).replace(/\u00a0/g, " ");
}

function valueOrDash(value: string): string {
  return value.trim() === "" ? EM_DASH : value.trim();
}

function instagramValue(handle: string): string {
  const clean = normaliseInstagramHandle(handle);
  return clean === "" ? EM_DASH : `@${clean}`;
}

function hairdoValue(hairdo: string): string {
  if (isStyle(hairdo)) return STYLE_COPY[hairdo].label;
  return valueOrDash(hairdo);
}

function style(
  font: InvoiceFont,
  size: number,
  options: {
    weight?: 400 | 700;
    italic?: boolean;
    color?: string;
  } = {},
): InvoiceTextStyle {
  return {
    font,
    size,
    weight: options.weight ?? 400,
    italic: options.italic ?? false,
    color: options.color ?? INK,
  };
}

/** Keep words together when they fit the available width. */
function wrap(
  value: string,
  textStyle: InvoiceTextStyle,
  maxWidth: number,
  measure: InvoiceMeasure,
): string[] {
  const text = value.trim();
  if (text === "") return [EM_DASH];
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line) {
      const candidate = `${line} ${word}`;
      if (measure(candidate, textStyle) <= maxWidth) {
        line = candidate;
        continue;
      }
      lines.push(line);
      line = "";
    }
    if (measure(word, textStyle) <= maxWidth) {
      line = word;
      continue;
    }
    for (const character of word) {
      if (line && measure(line + character, textStyle) > maxWidth) {
        lines.push(line);
        line = "";
      }
      line += character;
    }
  }
  lines.push(line);
  return lines;
}

/**
 * Lay one Invoice out in reading order: header, identity, Services,
 * the money column, Payment Information, Format Order and the script
 * footer, behind a cream fill sized to the height reported with the list.
 * `measure` is the only width source, so the tests can drive wrapping
 * without a canvas.
 */
export function layoutInvoice(
  invoice: Invoice,
  business: InvoiceBusiness,
  measure: InvoiceMeasure,
): InvoiceLayout {
  const ops: InvoiceDrawOp[] = [];

  function text(
    value: string,
    x: number,
    y: number,
    align: InvoiceTextAlign,
    textStyle: InvoiceTextStyle,
  ) {
    ops.push({ kind: "text", text: value, x, y, align, ...textStyle });
  }

  function rule(
    y: number,
    width = 1,
    x1: number = LEFT,
    x2: number = RIGHT,
  ) {
    ops.push({ kind: "rule", x1, y1: y, x2, y2: y, width, color: RULE });
  }

  function doubleRule(y: number) {
    rule(y, 2);
    rule(y + 8, 0.75);
  }

  const body = style("body", 16);
  const bodyBold = style("body", 16, { weight: 700 });
  const label = style("body", 16, { color: MUTED });

  // Header: the wordmark and title, then the two public contact lines. Both
  // sides wrap, so a long name or handle never crosses the page edge.
  const wordmark = style("display", 46, { italic: true });
  let headerY = 136;
  for (const line of wrap(business.name, wordmark, 540, measure)) {
    text(line, LEFT, headerY, "left", wordmark);
    headerY += 50;
  }
  text(
    "INVOICE",
    RIGHT,
    134,
    "right",
    style("display", 38, { italic: true, color: MUTED }),
  );
  let contactY = Math.max(182, headerY + 4);
  for (const line of wrap(
    `WhatsApp ${valueOrDash(business.whatsapp)}`,
    body,
    CONTENT_WIDTH,
    measure,
  )) {
    text(line, LEFT, contactY, "left", body);
    contactY += 26;
  }
  for (const line of wrap(
    `Instagram ${instagramValue(business.instagram)}`,
    body,
    CONTENT_WIDTH,
    measure,
  )) {
    text(line, LEFT, contactY, "left", body);
    contactY += 26;
  }
  doubleRule(contactY + 6);

  // Identity block: number, saved dates and the client.
  let y = contactY + 60;
  text("No:", LEFT, y, "left", label);
  text(invoice.number, VALUE_X, y, "left", bodyBold);
  y += 30;
  text("Tanggal:", LEFT, y, "left", label);
  text(formatDateIdLong(invoice.issued_on), VALUE_X, y, "left", body);
  if (invoice.due_on !== null) {
    y += 30;
    text("Jatuh Tempo:", LEFT, y, "left", label);
    text(formatDateIdLong(invoice.due_on), VALUE_X, y, "left", body);
  }
  y += 44;
  text("Kepada:", LEFT, y, "left", label);
  const clientStyle = style("body", 18, { weight: 700 });
  let clientY = y;
  for (const line of wrap(
    invoice.client_name,
    clientStyle,
    RIGHT - VALUE_X,
    measure,
  )) {
    text(line, VALUE_X, clientY, "left", clientStyle);
    clientY += 24;
  }

  // The saved Service lines, with a Booking-wide row for earlier Invoices.
  const itemized = invoice.service_items.length > 0;
  const unitPriceX = 527;
  const quantityX = 641;
  let cursor = Math.max(444, clientY + 16);
  rule(cursor, 1.5);
  cursor += 34;
  text("ITEM", LEFT, cursor, "left", label);
  if (itemized) {
    text("HARGA SATUAN", unitPriceX, cursor, "right", label);
    text("JUMLAH", quantityX, cursor, "right", label);
  } else {
    text("ORANG", 590, cursor, "right", label);
  }
  text("TOTAL", RIGHT, cursor, "right", label);
  cursor += 14;
  rule(cursor);
  cursor += 38;

  const serviceStyle = style("body", 17, { weight: 700 });
  const serviceNames = itemized
    ? invoice.service_items.map(({ name }) => name)
    : invoice.service_names.length ? invoice.service_names : [""];
  const itemTop = cursor;
  for (const [index, name] of serviceNames.entries()) {
    if (index > 0) cursor += 5;
    const lineY = cursor;
    for (const line of wrap(name, serviceStyle, itemized ? 270 : RIGHT - LEFT - 320, measure)) {
      text(line, LEFT, cursor, "left", serviceStyle);
      cursor += 24;
    }
    const item = invoice.service_items[index];
    if (item) {
      text(invoiceAmount(item.unit_price), unitPriceX, lineY, "right", body);
      text(String(item.quantity), quantityX, lineY, "right", body);
      text(invoiceAmount(item.unit_price * item.quantity), RIGHT, lineY, "right", bodyBold);
    }
  }
  for (const line of wrap(valueOrDash(invoice.event_type), label, CONTENT_WIDTH, measure)) {
    text(line, LEFT, cursor + 2, "left", label);
    cursor += 24;
  }
  const itemBottom = Math.max(cursor + 6, itemTop + 58);
  if (!itemized) {
    text(`${invoice.headcount} orang`, 590, itemTop, "right", body);
    text(invoiceAmount(invoice.subtotal), RIGHT, itemTop, "right", bodyBold);
  }
  rule(itemBottom);

  // Totals: every amount comes from the frozen snapshot.
  const position = paymentPosition(invoice.subtotal, invoice.dp_amount, invoice.pelunasan_amount);
  y = itemBottom + 46;
  text("TOTAL", MONEY_LABEL_X, y, "left", label);
  text(invoiceAmount(invoice.subtotal), RIGHT, y, "right", body);
  y += 30;
  text("DP", MONEY_LABEL_X, y, "left", label);
  text(invoiceAmount(invoice.dp_amount), RIGHT, y, "right", body);
  if (invoice.pelunasan_amount !== null) {
    y += 30;
    text("PELUNASAN", MONEY_LABEL_X, y, "left", label);
    text(invoiceAmount(invoice.pelunasan_amount), RIGHT, y, "right", body);
  }
  y += 20;
  rule(y, 0.75, MONEY_LABEL_X, RIGHT);

  // The remaining balance is the focal point; its label and figure sit on
  // separate lines so the larger figure can never collide with the label.
  y += 34;
  text(
    "SISA PEMBAYARAN",
    MONEY_LABEL_X,
    y,
    "left",
    style("body", 18, { weight: 700, color: GOLD }),
  );
  y += 44;
  text(
    // An overpaid DP is Lunas, so it never shows as a negative balance.
    invoiceAmount(Math.max(0, position.remaining)),
    RIGHT,
    y,
    "right",
    style("body", 34, { weight: 700, color: GOLD }),
  );

  if (position.status === "Lunas") {
    const stampStyle = style("body", 60, { weight: 700, color: STAMP_RED });
    const halfWidth = (measure("LUNAS", stampStyle) + 64) / 2;
    const halfHeight = 42;
    const angle = -Math.PI / 12;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const stampX = LEFT + 155;
    const stampY = itemBottom + 104;
    function stampPoint(x: number, y: number) {
      return { x: stampX + x * cos - y * sin, y: stampY + x * sin + y * cos };
    }
    const corners = [
      stampPoint(-halfWidth, -halfHeight),
      stampPoint(halfWidth, -halfHeight),
      stampPoint(halfWidth, halfHeight),
      stampPoint(-halfWidth, halfHeight),
    ];
    for (const [i, from] of corners.entries()) {
      const to = corners[(i + 1) % corners.length];
      ops.push({ kind: "rule", x1: from.x, y1: from.y, x2: to.x, y2: to.y, width: 5, color: STAMP_RED });
    }
    ops.push({
      kind: "text", text: "LUNAS", ...stampPoint(0, 19),
      align: "center", rotation: angle, ...stampStyle,
    });
  } else {
    y += 24;
    const badgeStyle = style("body", 16, { weight: 700, color: PAPER });
    const badgeText = position.status.toUpperCase();
    const badgeWidth = measure(badgeText, badgeStyle) + 28;
    ops.push({
      kind: "fill",
      x: RIGHT - badgeWidth,
      y,
      width: badgeWidth,
      height: 30,
      color: INK,
    });
    text(badgeText, RIGHT - 14, y + 21, "right", badgeStyle);
    y += 30;
  }

  /** One label/value row; the value wraps at the page's right margin. */
  function valueRow(name: string, value: string, valueStyle: InvoiceTextStyle) {
    text(name, LEFT, y, "left", bodyBold);
    const lines = wrap(value, valueStyle, RIGHT - VALUE_X, measure);
    let lineY = y;
    for (const line of lines) {
      text(line, VALUE_X, lineY, "left", valueStyle);
      lineY += 24;
    }
    y = Math.max(y + 30, lineY + 6);
  }

  const sectionTitle = style("body", 18, { weight: 700 });
  if (position.status === "Lunas") {
    // Settled: nothing left to pay, so no bank block, prompt or refund note.
    y += 28;
    doubleRule(y + 18);
    y += 62;
    text("Pembayaran telah lunas.", LEFT, y, "left", sectionTitle);
    y += 34;
  } else if (invoice.due_on !== null) {
    y += 28;
    const noteStyle = style("body", 16, { color: MUTED });
    const noteLines = wrap(
      "DP tidak dapat dikembalikan.",
      noteStyle,
      RIGHT - 480,
      measure,
    );
    for (const line of noteLines) {
      text(line, RIGHT, y, "right", noteStyle);
      y += 22;
    }

    // Payment Information: empty values print an em dash, so a missing
    // setting is visible before the Invoice is sent.
    doubleRule(y + 18);
    y += 62;
    text("Informasi Pembayaran", LEFT, y, "left", sectionTitle);
    y += 34;
    for (const line of wrap(
      `Mohon lunasi sebelum ${formatDateIdLong(invoice.due_on)}`,
      bodyBold,
      CONTENT_WIDTH,
      measure,
    )) {
      text(line, LEFT, y, "left", bodyBold);
      y += 24;
    }
    y += 10;

    const paymentRows: Array<[string, string]> = [
      ["Bank:", business.bank.name],
      ["Nama Rekening:", business.bank.accountName],
      ["Nomor Rekening:", business.bank.accountNumber],
    ];
    for (const [name, value] of paymentRows) {
      valueRow(name, valueOrDash(value), body);
    }
  }

  // Format Order: Indonesian event date and labels, saved values.
  doubleRule(y + 16);
  y += 60;
  text("Detail Pesanan", LEFT, y, "left", sectionTitle);
  y += 34;

  valueRow("Tanggal Acara:", formatDateId(invoice.booking_date), body);
  valueRow("Jenis Acara:", valueOrDash(invoice.event_type), body);
  valueRow("Jumlah Orang:", `${invoice.headcount} orang`, body);
  valueRow("Gaya:", hairdoValue(invoice.hairdo), body);
  valueRow("Lokasi:", valueOrDash(invoice.venue), body);
  valueRow("No. Telepon:", valueOrDash(invoice.client_phone), body);
  valueRow("Jam Mulai:", valueOrDash(invoice.start_time), body);
  valueRow("Jam Selesai:", valueOrDash(invoice.end_time), body);

  // The script footer closes the page, below everything above it; the page
  // grows to hold it and never drops below the minimum height.
  const footerY = Math.max(INVOICE_PAGE.minHeight - FOOTER_BOTTOM, y + FOOTER_GAP);
  text(
    "Terima kasih",
    INVOICE_PAGE.width / 2,
    footerY,
    "center",
    style("script", 64, { color: GOLD }),
  );

  const height = footerY + FOOTER_BOTTOM;
  ops.unshift({
    kind: "fill",
    x: 0,
    y: 0,
    width: INVOICE_PAGE.width,
    height,
    color: PAPER,
  });
  return { height, ops };
}
