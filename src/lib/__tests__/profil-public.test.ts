import { describe, expect, it } from "vitest";
import {
  HERO_STATS,
  MAX_VISIBLE_STATS,
  resolveDisplayedStats,
  resolveHeroCopy,
  resolveHeroPortraitUrl,
} from "../hero-proof";

// Seam (pure): DB profil/stats → landing hero content. Catches missing
// fallback, missing max-4 slice, leaked hidden rows, and wrong portrait
// priority (profile > portfolio cover > null). Misses the DB visible=true
// filter itself (covered by profile-queries.test.ts).
describe("resolveDisplayedStats", () => {
  it("falls back to the hardcoded list when the DB has no visible rows", () => {
    expect(resolveDisplayedStats([])).toEqual(HERO_STATS);
  });

  it("maps DB rows (value/label) to landing items in sort order", () => {
    expect(
      resolveDisplayedStats([
        { value: "Satu", label: "A", visible: true },
        { value: "Dua", label: "B", visible: true },
      ]),
    ).toEqual([
      { value: "Satu", label: "A" },
      { value: "Dua", label: "B" },
    ]);
  });

  it("renders at most 4 stats", () => {
    expect(MAX_VISIBLE_STATS).toBe(4);
    const rows = Array.from({ length: 6 }, (_, i) => ({
      value: `V${i}`,
      label: `L${i}`,
      visible: true,
    }));
    const shown = resolveDisplayedStats(rows);
    expect(shown).toHaveLength(4);
    expect(shown[0]).toEqual({ value: "V0", label: "L0" });
  });

  it("sorts unsorted visible rows by sort ascending before slicing", () => {
    const shown = resolveDisplayedStats([
      { value: "C", label: "C", visible: true, sort: 30 },
      { value: "A", label: "A", visible: true, sort: 10 },
      { value: "B", label: "B", visible: true, sort: 20 },
    ]);
    expect(shown.map((s) => s.value)).toEqual(["A", "B", "C"]);
  });

  it("never renders hidden rows", () => {
    expect(
      resolveDisplayedStats([
        { value: "Tampil", label: "A", visible: true },
        { value: "Sembunyi", label: "B", visible: false },
      ]),
    ).toEqual([{ value: "Tampil", label: "A" }]);
  });

  it("falls back when every DB row is hidden", () => {
    expect(
      resolveDisplayedStats([{ value: "X", label: "Y", visible: false }]),
    ).toEqual(HERO_STATS);
  });
});

describe("resolveHeroPortraitUrl", () => {
  it("prefers the admin portrait over the portfolio cover", () => {
    expect(
      resolveHeroPortraitUrl("https://example.com/portrait.jpg", [
        { image_url: "https://example.com/a.jpg" },
      ]),
    ).toBe("https://example.com/portrait.jpg");
  });

  it("falls back to the first portfolio cover when portrait is empty", () => {
    expect(
      resolveHeroPortraitUrl(null, [
        { image_url: "https://example.com/a.jpg" },
        { image_url: "https://example.com/b.jpg" },
      ]),
    ).toBe("https://example.com/a.jpg");
    expect(resolveHeroPortraitUrl("   ", [{ image_url: "https://example.com/a.jpg" }])).toBe(
      "https://example.com/a.jpg",
    );
  });

  it("returns null when neither portrait nor portfolio cover exists", () => {
    expect(resolveHeroPortraitUrl(null, [])).toBeNull();
    expect(resolveHeroPortraitUrl(undefined, [])).toBeNull();
  });
});

describe("resolveHeroCopy", () => {
  it("returns live headline/subcopy when the profile row exists", () => {
    expect(
      resolveHeroCopy({ headline: "Halo", subcopy: "Deskripsi baru" }),
    ).toEqual({ headline: "Halo", subcopy: "Deskripsi baru" });
  });

  it("falls back to hardcoded copy when the profile is missing or blank", () => {
    const fallback = resolveHeroCopy(null);
    expect(fallback.headline.length).toBeGreaterThan(0);
    expect(fallback.subcopy.length).toBeGreaterThan(0);
    expect(resolveHeroCopy({ headline: "  ", subcopy: "  " })).toEqual(fallback);
    expect(resolveHeroCopy(undefined)).toEqual(fallback);
  });
});
