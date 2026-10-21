import { describe, expect, it } from "vitest";
import {
  canShareFile,
  invoicePngFileName,
  shareInvoicePng,
  type InvoiceShareTarget,
} from "../invoice-share";

function png(): Blob {
  return new Blob(["png-bytes"], { type: "image/png" });
}

function fileFrom(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: "image/png" });
}

// Seam: the browser sharing adapter with an injected navigator and download.
// Catches sharing when file sharing is unsupported, downloading on a cancelled
// share, and a filename a phone cannot save. Misses the real share sheet.
describe("shareInvoicePng", () => {
  const FILENAME = invoicePngFileName("invc-05/2026");
  const TITLE = "Invoice invc-05/2026";

  it("names the downloaded file after the invoice number", () => {
    expect(FILENAME).toBe("invoice-invc-05-2026.png");
  });

  it("shares the PNG file when the browser can share files", async () => {
    const shared: ShareData[] = [];
    const target: InvoiceShareTarget = {
      canShare: (data) => data?.files?.[0]?.type === "image/png",
      share: async (data) => {
        shared.push(data);
      },
    };
    let downloads = 0;

    const outcome = await shareInvoicePng(png(), FILENAME, TITLE, {
      target,
      download: () => {
        downloads += 1;
      },
    });

    expect(outcome).toBe("shared");
    expect(downloads).toBe(0);
    expect(shared).toHaveLength(1);
    expect(shared[0].title).toBe(TITLE);
    const file = shared[0].files?.[0];
    expect(file?.name).toBe(FILENAME);
    expect(file?.type).toBe("image/png");
  });

  it("downloads the same PNG when file sharing is unsupported", async () => {
    const blob = png();
    const downloaded: File[] = [];
    const target: InvoiceShareTarget = {
      canShare: () => false,
      share: async () => {
        throw new Error("should not be called");
      },
    };

    const outcome = await shareInvoicePng(blob, FILENAME, TITLE, {
      target,
      download: (file) => {
        downloaded.push(file);
      },
    });

    expect(outcome).toBe("downloaded");
    expect(downloaded).toHaveLength(1);
    expect(downloaded[0].name).toBe(FILENAME);
    expect(downloaded[0].type).toBe("image/png");
  });

  it("downloads when the browser has no share API at all", async () => {
    const downloaded: File[] = [];
    const outcome = await shareInvoicePng(png(), FILENAME, TITLE, {
      target: {},
      download: (file) => {
        downloaded.push(file);
      },
    });

    expect(outcome).toBe("downloaded");
    expect(downloaded).toHaveLength(1);
  });

  it("downloads when canShare itself throws", async () => {
    const downloaded: File[] = [];
    const target: InvoiceShareTarget = {
      canShare: () => {
        throw new Error("unsupported probe");
      },
      share: async () => {},
    };

    const outcome = await shareInvoicePng(png(), FILENAME, TITLE, {
      target,
      download: (file) => {
        downloaded.push(file);
      },
    });

    expect(outcome).toBe("downloaded");
    expect(downloaded).toHaveLength(1);
  });

  it("does not download when the admin cancels the share sheet", async () => {
    let downloads = 0;
    const target: InvoiceShareTarget = {
      canShare: () => true,
      share: async () => {
        throw new DOMException("cancelled", "AbortError");
      },
    };

    const outcome = await shareInvoicePng(png(), FILENAME, TITLE, {
      target,
      download: () => {
        downloads += 1;
      },
    });

    expect(outcome).toBe("cancelled");
    expect(downloads).toBe(0);
  });

  it("falls back to a download when the share sheet fails", async () => {
    const downloaded: File[] = [];
    const target: InvoiceShareTarget = {
      canShare: () => true,
      share: async () => {
        throw new Error("share unavailable");
      },
    };

    const outcome = await shareInvoicePng(png(), FILENAME, TITLE, {
      target,
      download: (file) => {
        downloaded.push(file);
      },
    });

    expect(outcome).toBe("downloaded");
    expect(downloaded).toHaveLength(1);
  });
});

describe("canShareFile", () => {
  it("requires both share and canShare", () => {
    const file = fileFrom(png(), "invoice.png");
    expect(canShareFile(file, {})).toBe(false);
    expect(canShareFile(file, { share: async () => {} })).toBe(false);
    expect(
      canShareFile(file, { share: async () => {}, canShare: () => true }),
    ).toBe(true);
  });
});
