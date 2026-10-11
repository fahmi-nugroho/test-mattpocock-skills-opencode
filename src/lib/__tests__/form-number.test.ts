import { describe, expect, it } from "vitest";
import { parseRequiredNumber } from "../admin/form-number";

// Seam 1 (pure): required numeric form fields. Catches blank inputs
// (Number("") === 0 would silently create Rp 0 prices) before validation.
describe("parseRequiredNumber", () => {
  it("parses a filled numeric string", () => {
    expect(parseRequiredNumber("500000", "Harga")).toBe(500000);
  });

  it("rejects a blank input instead of defaulting to 0", () => {
    expect(() => parseRequiredNumber("", "Harga")).toThrow(/wajib diisi/i);
    expect(() => parseRequiredNumber("   ", "Harga")).toThrow(/wajib diisi/i);
  });

  it("rejects a non-numeric input", () => {
    expect(() => parseRequiredNumber("abc", "Harga")).toThrow(/tidak valid/i);
  });
});
