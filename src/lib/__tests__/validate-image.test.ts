import { describe, expect, it } from "vitest";
import { checkImageFile, MAX_IMAGE_BYTES } from "../admin/validate-image";

// Seam 1 (pure): admin image file checks with known-good literals.
// Catches non-image/oversize files before a storage upload.
// Misses live bucket policies.
describe("checkImageFile", () => {
  it("accepts an image within the size limit", () => {
    expect(() =>
      checkImageFile({ type: "image/jpeg", size: 1024 }),
    ).not.toThrow();
  });

  it("rejects a non-image file instead of uploading a broken tile", () => {
    expect(() => checkImageFile({ type: "application/pdf", size: 1024 })).toThrow(
      /gambar/i,
    );
  });

  it("rejects an oversize image instead of failing mid-upload", () => {
    expect(() =>
      checkImageFile({ type: "image/png", size: MAX_IMAGE_BYTES + 1 }),
    ).toThrow(/5 MB/i);
  });
});
