import { describe, expect, it } from "vitest";
import { assertNonNegativeInt, parseRequiredNumber } from "../admin/form-number";

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

describe("assertNonNegativeInt", () => {
  it("passes an integer >= 0 through", () => {
    expect(assertNonNegativeInt(0, "Urutan")).toBe(0);
    expect(assertNonNegativeInt(3, "Urutan")).toBe(3);
  });

  it("rejects negative or non-integer values", () => {
    expect(() => assertNonNegativeInt(-1, "Urutan")).toThrow(/Urutan/i);
    expect(() => assertNonNegativeInt(1.5, "Urutan")).toThrow(/bulat/i);
    expect(() => assertNonNegativeInt(NaN, "Urutan")).toThrow(/bulat/i);
  });
});
