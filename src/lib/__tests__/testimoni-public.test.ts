import { describe, expect, it } from "vitest";
import {
  MAX_VISIBLE_TESTIMONIALS,
  TESTIMONIALS,
  resolveDisplayedTestimonials,
} from "../hero-proof";

// Seam (pure): DB rows → landing testimonial list. Catches missing
// fallback, missing max-6 slice, and leaked hidden rows. Misses the DB
// visible=true filter itself (covered by profile-queries.test.ts).
describe("resolveDisplayedTestimonials", () => {
  it("falls back to the hardcoded list when the DB has no visible rows", () => {
    expect(resolveDisplayedTestimonials([])).toEqual(TESTIMONIALS);
  });

  it("maps DB rows (client_name) to landing items in sort order", () => {
    expect(
      resolveDisplayedTestimonials([
        { quote: "Satu", client_name: "A", visible: true },
        { quote: "Dua", client_name: "B", visible: true },
      ]),
    ).toEqual([
      { quote: "Satu", name: "A" },
      { quote: "Dua", name: "B" },
    ]);
  });

  it("renders at most 6 testimonials", () => {
    expect(MAX_VISIBLE_TESTIMONIALS).toBe(6);
    const rows = Array.from({ length: 8 }, (_, i) => ({
      quote: `Quote ${i}`,
      client_name: `Klien ${i}`,
      visible: true,
    }));
    const shown = resolveDisplayedTestimonials(rows);
    expect(shown).toHaveLength(6);
    expect(shown[0]).toEqual({ quote: "Quote 0", name: "Klien 0" });
  });

  it("sorts unsorted visible rows by sort ascending before slicing", () => {
    const shown = resolveDisplayedTestimonials([
      { quote: "C", client_name: "C", visible: true, sort: 30 },
      { quote: "A", client_name: "A", visible: true, sort: 10 },
      { quote: "B", client_name: "B", visible: true, sort: 20 },
    ]);
    expect(shown.map((t) => t.quote)).toEqual(["A", "B", "C"]);
  });

  it("preserves ids so duplicate client names stay distinct", () => {
    const shown = resolveDisplayedTestimonials([
      { id: "id-1", quote: "Satu", client_name: "Sama", visible: true, sort: 0 },
      { id: "id-2", quote: "Dua", client_name: "Sama", visible: true, sort: 1 },
    ]);
    expect(shown).toEqual([
      { id: "id-1", quote: "Satu", name: "Sama" },
      { id: "id-2", quote: "Dua", name: "Sama" },
    ]);
    const keys = shown.map((t) => t.id ?? t.name);
    expect(new Set(keys).size).toBe(shown.length);
  });

  it("never renders hidden rows", () => {
    expect(
      resolveDisplayedTestimonials([
        { quote: "Tampil", client_name: "A", visible: true },
        { quote: "Sembunyi", client_name: "B", visible: false },
      ]),
    ).toEqual([{ quote: "Tampil", name: "A" }]);
  });

  it("falls back when every DB row is hidden", () => {
    expect(
      resolveDisplayedTestimonials([
        { quote: "Sembunyi", client_name: "B", visible: false },
      ]),
    ).toEqual(TESTIMONIALS);
  });
});
