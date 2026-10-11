import { describe, expect, it } from "vitest";
import { validatePortfolioInput } from "../admin/validate-portfolio";

// Seam 1 (pure): portfolio form validation with known-good literals.
// Catches bad title/category/sort before a DB write. Misses live DB CHECKs.
describe("validatePortfolioInput", () => {
  it("accepts a valid portfolio item", () => {
    expect(
      validatePortfolioInput({
        title: "Pengantin Adat",
        category: "Wedding",
        sort: 0,
        visible: true,
      }),
    ).toEqual({
      title: "Pengantin Adat",
      category: "Wedding",
      sort: 0,
      visible: true,
    });
  });

  it("trims title and category", () => {
    expect(
      validatePortfolioInput({
        title: "  Pengantin  ",
        category: "  Wedding ",
        sort: 2,
        visible: false,
      }),
    ).toEqual({
      title: "Pengantin",
      category: "Wedding",
      sort: 2,
      visible: false,
    });
  });

  it("rejects a blank title instead of saving an untitled grid tile", () => {
    expect(() =>
      validatePortfolioInput({
        title: "   ",
        category: "Wedding",
        sort: 0,
        visible: true,
      }),
    ).toThrow(/judul|title/i);
  });

  it("rejects a blank category instead of breaking the filter tabs", () => {
    expect(() =>
      validatePortfolioInput({
        title: "Pengantin Adat",
        category: "  ",
        sort: 0,
        visible: true,
      }),
    ).toThrow(/kategori|category/i);
  });

  it("rejects a negative or non-integer sort", () => {
    expect(() =>
      validatePortfolioInput({
        title: "Pengantin Adat",
        category: "Wedding",
        sort: -1,
        visible: true,
      }),
    ).toThrow(/urut|sort/i);
    expect(() =>
      validatePortfolioInput({
        title: "Pengantin Adat",
        category: "Wedding",
        sort: 1.5,
        visible: true,
      }),
    ).toThrow(/urut|sort/i);
  });
});
