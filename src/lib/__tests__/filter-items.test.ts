import { describe, expect, it } from "vitest";
import { filterByQuery } from "../admin/filter-items";

// Seam (pure): client-side substring filter over picked text fields.
// Catches case handling, empty-query passthrough, no-match []. Misses
// component wiring (managers pass their own field pickers).
describe("filterByQuery", () => {
  const items = [
    { id: "1", title: "Rias Wedding", category: "Wedding" },
    { id: "2", title: "Wisuda Cantik", category: "Graduation" },
  ];
  const pick = (i: (typeof items)[number]) => [i.title, i.category];

  it("returns all items on empty query", () => {
    expect(filterByQuery(items, "", pick)).toEqual(items);
    expect(filterByQuery(items, "   ", pick)).toEqual(items);
  });

  it("matches case-insensitively", () => {
    expect(filterByQuery(items, "wedding", pick)).toEqual([items[0]]);
    expect(filterByQuery(items, "WISUDA", pick)).toEqual([items[1]]);
  });

  it("matches across any picked field", () => {
    expect(filterByQuery(items, "graduation", pick)).toEqual([items[1]]);
    expect(filterByQuery(items, "rias", pick)).toEqual([items[0]]);
  });

  it("returns [] when nothing matches", () => {
    expect(filterByQuery(items, "uwaitidakada", pick)).toEqual([]);
  });

  it("skips null/undefined fields without throwing", () => {
    const rows = [{ a: null as string | null, b: undefined as string | undefined }];
    expect(filterByQuery(rows, "x", (r) => [r.a, r.b])).toEqual([]);
    expect(filterByQuery(rows, "", (r) => [r.a, r.b])).toEqual(rows);
  });
});
