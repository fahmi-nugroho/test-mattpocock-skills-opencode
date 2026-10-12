import { describe, expect, it } from "vitest";
import { getHeroPortraitUrl } from "../hero-proof";

describe("getHeroPortraitUrl", () => {
  it("returns the first visible portfolio cover as the hero portrait fallback", () => {
    expect(
      getHeroPortraitUrl([
        { image_url: "https://example.com/a.jpg" },
        { image_url: "https://example.com/b.jpg" },
      ]),
    ).toBe("https://example.com/a.jpg");
  });

  it("returns null when no portfolio cover is visible", () => {
    expect(getHeroPortraitUrl([])).toBeNull();
  });
});
