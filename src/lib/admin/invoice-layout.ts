/**
 * The Invoice picture's pure layout (invoice-and-booking-filter ticket 04).
 *
 * Given the saved Invoice snapshot, the business details and an injected
 * text-measurement function, this returns the ordered draw operations for one
 * 900x1600 cream page. It never touches a canvas: the painter just executes
 * the list, so every content, order, margin, alignment and wrapping decision
 * can be tested without pixels.
 *
 * The saved snapshot is the only source of client, event and money values;
 * the live Booking is never read here. Business identity and payment settings
 * arrive separately, and an empty setting becomes an em dash so its block
 * never disappears.
 */

import { formatDateEn, formatDateId, formatIDR } from "../format";
import { normaliseInstagramHandle } from "../instagram";
import { isStyle, STYLE_COPY } from "../style-reference";
import type { Invoice } from "../supabase/database";
import { paymentPosition, type InvoiceBusiness } from "./invoice";

export const INVOICE_PAGE = {
  width: 900,
  height: 1600,
  margin: 72,
} as const;

const LEFT = INVOICE_PAGE.margin;
const RIGHT = INVOICE_PAGE.width - INVOICE_PAGE.margin;
const CONTENT_WIDTH = RIGHT - LEFT;
const VALUE_X = 220;
const MONEY_LABEL_X = 500;
const EM_DASH = "—";

const PAPER = "#fbf6ec";
const INK = "#2e2620";
const MUTED = "#756553";
const RULE = "#c9b79a";
const GOLD = "#8a5a2b";

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

/** Split on words, accumulating only while the injected measurement fits. */
function wrap(
  value: string,
  textStyle: InvoiceTextStyle,
  maxWidth: number,
  measure: InvoiceMeasure,
): string[] {
  const text = value.trim();
  if (text === "") return [EM_DASH];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = words[0];
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`;
    if (measure(candidate, textStyle) <= maxWidth) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

/**
 * Lay one Invoice out in reading order: paper, header, identity, the single
 * item, the money column, Payment Information, Format Order and the script
 * footer. `measure` is the only width source, so the tests can drive wrapping
 * without a canvas.
 */
export function layoutInvoice(
  invoice: Invoice,
  business: InvoiceBusiness,
  measure: InvoiceMeasure,
): InvoiceDrawOp[] {
  const ops: InvoiceDrawOp[] = [
    {
      kind: "fill",
      x: 0,
      y: 0,
      width: INVOICE_PAGE.width,
      height: INVOICE_PAGE.height,
      color: PAPER,
    },
  ];

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

  const body = style("body", 15);
  const bodyBold = style("body", 15, { weight: 700 });
  const label = style("body", 13, { color: MUTED });

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

  // Identity block: number, both English dates and the client.
  let y = contactY + 60;
  text("No:", LEFT, y, "left", label);
  text(invoice.number, VALUE_X, y, "left", bodyBold);
  y += 30;
  text("Date:", LEFT, y, "left", label);
  text(formatDateEn(invoice.issued_on), VALUE_X, y, "left", body);
  y += 30;
  text("Due Date:", LEFT, y, "left", label);
  text(formatDateEn(invoice.due_on), VALUE_X, y, "left", body);
  y += 44;
  text("To:", LEFT, y, "left", label);
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

  // One line item, its event type beneath, and the right-aligned money column.
  let cursor = Math.max(444, clientY + 16);
  rule(cursor, 1.5);
  cursor += 34;
  text("ITEM", LEFT, cursor, "left", label);
  text("QTY", 590, cursor, "right", label);
  text("PRICE", 710, cursor, "right", label);
  text("TOTAL", RIGHT, cursor, "right", label);
  cursor += 14;
  rule(cursor);
  cursor += 38;

  const serviceStyle = style("body", 17, { weight: 700 });
  const serviceLines = wrap(
    invoice.service_name,
    serviceStyle,
    RIGHT - LEFT - 320,
    measure,
  );
  const itemTop = cursor;
  for (const line of serviceLines) {
    text(line, LEFT, cursor, "left", serviceStyle);
    cursor += 24;
  }
  text(
    valueOrDash(invoice.event_type),
    LEFT,
    cursor + 2,
    "left",
    style("body", 14, { color: MUTED }),
  );
  const itemBottom = Math.max(cursor + 30, itemTop + 58);
  text("1", 590, itemTop, "right", body);
  text(invoiceAmount(invoice.subtotal), 710, itemTop, "right", body);
  text(invoiceAmount(invoice.subtotal), RIGHT, itemTop, "right", bodyBold);
  rule(itemBottom);

  // Totals: every amount comes from the frozen snapshot.
  const position = paymentPosition(invoice.subtotal, invoice.dp_amount);
  y = itemBottom + 46;
  text("SUBTOTAL", MONEY_LABEL_X, y, "left", label);
  text(invoiceAmount(invoice.subtotal), RIGHT, y, "right", body);
  y += 30;
  text("DP", MONEY_LABEL_X, y, "left", label);
  text(invoiceAmount(invoice.dp_amount), RIGHT, y, "right", body);
  y += 20;
  rule(y, 0.75, MONEY_LABEL_X, RIGHT);
  y += 14;
  text("PELUNASAN", MONEY_LABEL_X, y, "left", bodyBold);
  text(invoiceAmount(position.remaining), RIGHT, y, "right", bodyBold);
  y += 34;
  text("Payment Status:", MONEY_LABEL_X, y, "left", bodyBold);
  text(position.status, RIGHT, y, "right", bodyBold);

  y += 26;
  const noteStyle = style("body", 12, { color: MUTED });
  const note = "The down payment is non-refundable.";
  const noteLines = wrap(note, noteStyle, RIGHT - 480, measure);
  for (const line of noteLines) {
    text(line, RIGHT, y, "right", noteStyle);
    y += 18;
  }

  // Payment Information: never hidden, empty values print an em dash.
  doubleRule(y + 18);
  y += 62;
  text(
    "Payment Information",
    LEFT,
    y,
    "left",
    style("body", 18, { weight: 700 }),
  );
  y += 34;

  /** One label/value row; the value wraps at the page's right margin. */
  function valueRow(name: string, value: string, valueStyle: InvoiceTextStyle) {
    text(name, LEFT, y, "left", bodyBold);
    const lines = wrap(value, valueStyle, RIGHT - VALUE_X, measure);
    let lineY = y;
    for (const line of lines) {
      text(line, VALUE_X, lineY, "left", valueStyle);
      lineY += 22;
    }
    y = Math.max(y + 30, lineY + 6);
  }

  const paymentRows: Array<[string, string]> = [
    ["Bank:", business.bank.name],
    ["Account Name:", business.bank.accountName],
    ["Account Number:", business.bank.accountNumber],
  ];
  for (const [name, value] of paymentRows) {
    valueRow(name, valueOrDash(value), body);
  }

  // Format Order: Indonesian event date, English labels, saved values.
  doubleRule(y + 16);
  y += 60;
  text(
    "Format Order",
    LEFT,
    y,
    "left",
    style("body", 18, { weight: 700 }),
  );
  y += 34;

  valueRow("Event Date:", formatDateId(invoice.booking_date), body);
  valueRow("Event Type:", valueOrDash(invoice.event_type), body);
  valueRow("Headcount:", `${invoice.headcount} orang`, body);
  valueRow("Hairdo:", hairdoValue(invoice.hairdo), body);
  valueRow("Venue:", valueOrDash(invoice.venue), body);
  valueRow("Client Phone:", valueOrDash(invoice.client_phone), body);
  valueRow("Start Time:", valueOrDash(invoice.start_time), body);
  valueRow("Finish Time:", valueOrDash(invoice.end_time), body);

  // The script footer closes the page, below the block above it.
  text(
    "Thank You",
    INVOICE_PAGE.width / 2,
    Math.max(1512, y + 80),
    "center",
    style("script", 64, { color: GOLD }),
  );

  return ops;
}
