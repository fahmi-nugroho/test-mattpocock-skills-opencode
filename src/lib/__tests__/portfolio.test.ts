import { describe, expect, it } from "vitest";
import {
  filterPortfolioItems,
  getPortfolioCategories,
} from "../portfolio";
import type { PortfolioItem } from "../supabase/database";

function item(
  overrides: Partial<PortfolioItem> & { id: string },
): PortfolioItem {
  return {
    title: "Look",
    category: "Wedding",
    image_url: "https://example.com/a.jpg",
    sort: 0,
    visible: true,
    ...overrides,
  };
}

describe("getPortfolioCategories", () => {
  it("returns unique categories in first-seen order with Semua first", () => {
    const items = [
      item({ id: "1", category: "Wedding" }),
      item({ id: "2", category: "Wisuda" }),
      item({ id: "3", category: "Wedding" }),
    ];
    expect(getPortfolioCategories(items)).toEqual([
      "Semua",
      "Wedding",
      "Wisuda",
    ]);
  });

  it("returns only Semua for an empty grid", () => {
    expect(getPortfolioCategories([])).toEqual(["Semua"]);
  });

  it("caps categories at six plus Semua for v1", () => {
    const items = Array.from({ length: 8 }, (_, i) =>
      item({ id: `${i}`, category: `Cat${i}` }),
    );
    expect(getPortfolioCategories(items)).toEqual([
      "Semua",
      "Cat0",
      "Cat1",
      "Cat2",
      "Cat3",
      "Cat4",
      "Cat5",
    ]);
  });
});

describe("filterPortfolioItems", () => {
  it("returns every item for Semua", () => {
    const items = [
      item({ id: "1", category: "Wedding" }),
      item({ id: "2", category: "Wisuda" }),
    ];
    expect(filterPortfolioItems(items, "Semua")).toEqual(items);
  });

  it("filters to the selected category only", () => {
    const items = [
      item({ id: "1", category: "Wedding" }),
      item({ id: "2", category: "Wisuda" }),
    ];
    expect(filterPortfolioItems(items, "Wisuda")).toEqual([items[1]]);
  });

  it("returns empty when no item matches", () => {
    const items = [item({ id: "1", category: "Wedding" })];
    expect(filterPortfolioItems(items, "Engagement")).toEqual([]);
  });
});
