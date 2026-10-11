import { describe, expect, it } from "vitest";
import { validateServiceInput } from "../admin/validate-service";

// Seam 1 (pure): price/service form validation with known-good literals.
// Catches bad name/price/duration before a DB write. Misses live DB CHECKs.
describe("validateServiceInput", () => {
  it("accepts a valid price item", () => {
    expect(
      validateServiceInput({
        name: "Makeup Wisuda",
        description: "Rias natural tahan lama",
        price_idr: 500000,
        duration_min: 120,
        active: true,
        sort: 0,
      }),
    ).toEqual({
      name: "Makeup Wisuda",
      description: "Rias natural tahan lama",
      price_idr: 500000,
      duration_min: 120,
      active: true,
      sort: 0,
    });
  });

  it("trims name and defaults a missing description to empty", () => {
    expect(
      validateServiceInput({
        name: "  Makeup Wisuda  ",
        price_idr: 500000,
        duration_min: 120,
        active: true,
        sort: 1,
      }),
    ).toEqual({
      name: "Makeup Wisuda",
      description: "",
      price_idr: 500000,
      duration_min: 120,
      active: true,
      sort: 1,
    });
  });

  it("rejects a blank name instead of saving an unnamed price card", () => {
    expect(() =>
      validateServiceInput({
        name: "   ",
        description: "",
        price_idr: 500000,
        duration_min: 120,
        active: true,
        sort: 0,
      }),
    ).toThrow(/nama|name/i);
  });

  it("rejects a negative price instead of breaking the IDR display", () => {
    expect(() =>
      validateServiceInput({
        name: "Makeup Wisuda",
        description: "",
        price_idr: -1000,
        duration_min: 120,
        active: true,
        sort: 0,
      }),
    ).toThrow(/harga|price/i);
  });

  it("rejects a non-positive duration instead of breaking scheduling", () => {
    expect(() =>
      validateServiceInput({
        name: "Makeup Wisuda",
        description: "",
        price_idr: 500000,
        duration_min: 0,
        active: true,
        sort: 0,
      }),
    ).toThrow(/durasi|duration/i);
  });

  it("rejects a negative or non-integer sort", () => {
    expect(() =>
      validateServiceInput({
        name: "Makeup Wisuda",
        description: "",
        price_idr: 500000,
        duration_min: 120,
        active: true,
        sort: -1,
      }),
    ).toThrow(/urut|sort/i);
  });
});
