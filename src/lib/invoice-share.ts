/**
 * Sharing adapter for the Invoice picture (invoice-and-booking-filter
 * ticket 05). On a phone that can share files this opens the system share
 * sheet with the same PNG the preview drew; anywhere else — a desktop
 * browser, mainly — it downloads that PNG so the admin can attach it by
 * hand. Nothing is uploaded and nothing here touches the Invoice's sent
 * state.
 */

/** The part of `navigator` this adapter needs, injectable for tests. */
export interface InvoiceShareTarget {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data?: ShareData) => boolean;
}

export interface InvoiceShareDeps {
  target?: InvoiceShareTarget;
  download?: (file: File) => void;
}

export type InvoiceShareOutcome = "shared" | "downloaded" | "cancelled";

/** A safe attachment name built from the invoice number, e.g. invc-05/2026. */
export function invoicePngFileName(invoiceNumber: string): string {
  const safe = invoiceNumber
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `invoice-${safe || "png"}.png`;
}

/**
 * File sharing needs both `share` and a `canShare` answer for the actual
 * file: some browsers have `share` for text only. A throwing probe is a no.
 */
export function canShareFile(
  file: File,
  target: InvoiceShareTarget,
): boolean {
  if (typeof target.share !== "function") return false;
  if (typeof target.canShare !== "function") return false;
  try {
    return target.canShare({ files: [file] });
  } catch {
    return false;
  }
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name?: unknown }).name === "AbortError"
  );
}

/** The desktop path: hand the PNG to the browser as a file download. */
function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Let the download start before the object URL goes away; a zero-delay
  // revoke can abort it in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Share one PNG through the system sheet, or download it where file sharing
 * is unavailable. A cancelled sheet is not a failure and must not silently
 * download instead; any other share failure still gets the picture out via
 * the download path.
 */
export async function shareInvoicePng(
  blob: Blob,
  filename: string,
  title: string,
  deps: InvoiceShareDeps = {},
): Promise<InvoiceShareOutcome> {
  const file = new File([blob], filename, { type: "image/png" });
  const target =
    deps.target ??
    (typeof navigator === "undefined" ? {} : (navigator as InvoiceShareTarget));
  const download = deps.download ?? downloadFile;
  const share = target.share;

  if (share && canShareFile(file, target)) {
    try {
      await share({ files: [file], title });
      return "shared";
    } catch (err) {
      if (isAbortError(err)) return "cancelled";
    }
  }

  download(file);
  return "downloaded";
}
