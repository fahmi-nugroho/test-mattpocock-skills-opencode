/**
 * The Invoice picture's thin canvas painter (invoice-and-booking-filter
 * ticket 04). It executes the operation list from `layoutInvoice` and makes
 * no content or layout decisions of its own.
 *
 * The page is drawn at a 2x backing scale (1800x3200 for the logical page)
 * and exported as PNG. Font families come from the next/font CSS variables on
 * <body>; loading is best-effort and timed, so a slow or failed font never
 * blocks the invoice — the fallback stack still renders every mark.
 */

import {
  INVOICE_PAGE,
  layoutInvoice,
  type InvoiceDrawOp,
  type InvoiceFont,
  type InvoiceMeasure,
  type InvoiceTextStyle,
} from "./admin/invoice-layout";
import type { InvoiceBusiness } from "./admin/invoice";
import type { Invoice } from "./supabase/database";

interface InvoiceFontFamilies {
  body: string;
  display: string;
  script: string;
}

const FALLBACK_FAMILIES: InvoiceFontFamilies = {
  body: "ui-monospace, 'Courier New', monospace",
  display: "Georgia, 'Times New Roman', serif",
  script: "cursive",
};

const BACKING_SCALE = 2;
const FONT_LOAD_TIMEOUT_MS = 3000;

function cssVariable(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function withFallback(value: string, fallback: string): string {
  return value ? `${value}, ${fallback}` : fallback;
}

/** Resolve the loaded families from the page, else keep the local fallbacks. */
function resolveInvoiceFonts(): InvoiceFontFamilies {
  return {
    body: withFallback(
      cssVariable("--font-invoice-body"),
      FALLBACK_FAMILIES.body,
    ),
    display: withFallback(
      cssVariable("--font-display"),
      FALLBACK_FAMILIES.display,
    ),
    script: withFallback(
      cssVariable("--font-invoice-script"),
      FALLBACK_FAMILIES.script,
    ),
  };
}

/** One canvas `font` string from a layout style; the painter's only mapping. */
function canvasFont(
  style: Pick<InvoiceTextStyle, "font" | "size" | "weight" | "italic">,
  families: InvoiceFontFamilies,
): string {
  const family: Record<InvoiceFont, string> = {
    body: families.body,
    display: families.display,
    script: families.script,
  };
  return `${style.italic ? "italic " : ""}${style.weight} ${style.size}px ${
    family[style.font]
  }`;
}

/**
 * Await the body, italic display and script faces, but never longer than a
 * short timeout: a missing network font degrades to the fallback instead of
 * leaving the admin staring at a spinner. Size is irrelevant for face
 * selection here, so one probe per family/weight/style is enough.
 */
async function loadInvoiceFonts(
  families: InvoiceFontFamilies,
  timeoutMs = FONT_LOAD_TIMEOUT_MS,
): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const loads = [
    document.fonts.load(`400 16px ${families.body}`),
    document.fonts.load(`700 16px ${families.body}`),
    document.fonts.load(`italic 400 16px ${families.display}`),
    document.fonts.load(`400 16px ${families.script}`),
  ].map((load) => load.catch(() => []));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  await Promise.race([Promise.all(loads).then(() => undefined), timeout]);
  if (timer) clearTimeout(timer);
}

/** Execute the ordered operation list. No decisions beyond fill/stroke/text. */
function paintInvoice(
  ctx: CanvasRenderingContext2D,
  ops: readonly InvoiceDrawOp[],
  families: InvoiceFontFamilies,
): void {
  for (const op of ops) {
    if (op.kind === "fill") {
      ctx.fillStyle = op.color;
      ctx.fillRect(op.x, op.y, op.width, op.height);
      continue;
    }
    if (op.kind === "rule") {
      ctx.strokeStyle = op.color;
      ctx.lineWidth = op.width;
      ctx.beginPath();
      ctx.moveTo(op.x1, op.y1);
      ctx.lineTo(op.x2, op.y2);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = op.color;
    ctx.font = canvasFont(op, families);
    ctx.textAlign = op.align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(op.text, op.x, op.y);
  }
}

/** Apply the backing scale, then paint the logical page-sized operation list. */
function paintInvoiceToCanvas(
  canvas: HTMLCanvasElement,
  ops: readonly InvoiceDrawOp[],
  families: InvoiceFontFamilies,
): void {
  canvas.width = INVOICE_PAGE.width * BACKING_SCALE;
  canvas.height = INVOICE_PAGE.height * BACKING_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak tersedia di browser ini.");
  ctx.setTransform(BACKING_SCALE, 0, 0, BACKING_SCALE, 0, 0);
  paintInvoice(ctx, ops, families);
}

function measureWith(
  ctx: CanvasRenderingContext2D,
  families: InvoiceFontFamilies,
): InvoiceMeasure {
  return (text, style) => {
    ctx.font = canvasFont(style, families);
    return ctx.measureText(text).width;
  };
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Gagal mengekspor invoice sebagai PNG."));
    }, "image/png");
  });
}

/**
 * Render one saved Invoice to a crisp PNG at twice the logical page scale.
 * Layout is measured from the same canvas context that paints it, and fonts
 * are awaited (with their fallbacks) before the first mark is drawn.
 */
export async function renderInvoicePng(
  invoice: Invoice,
  business: InvoiceBusiness,
): Promise<Blob> {
  const families = resolveInvoiceFonts();
  await loadInvoiceFonts(families);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak tersedia di browser ini.");
  const ops = layoutInvoice(invoice, business, measureWith(ctx, families));
  paintInvoiceToCanvas(canvas, ops, families);
  return canvasToPng(canvas);
}
