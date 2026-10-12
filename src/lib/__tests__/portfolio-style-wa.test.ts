import { describe, expect, it } from "vitest";
import { buildStyleWaLink, buildStyleWaMessage } from "../whatsapp";

describe("portfolio style WA inquiry (lightbox CTA)", () => {
  it("builds a style message containing title and category", () => {
    expect(buildStyleWaMessage("Glowing Natural", "Natural")).toBe(
      "Halo, mau tanya gaya Glowing Natural (Natural)",
    );
  });

  it("builds a wa.me link with the encoded style message", () => {
    const message = buildStyleWaMessage("Glowing Natural", "Natural");
    expect(buildStyleWaLink("6281234567890", "Glowing Natural", "Natural")).toBe(
      `https://wa.me/6281234567890?text=${encodeURIComponent(message)}`,
    );
  });

  it("normalises non-digit characters in the number", () => {
    const message = buildStyleWaMessage("Bold Glam", "Glam");
    expect(
      buildStyleWaLink("+62 812-3456-789", "Bold Glam", "Glam"),
    ).toBe(`https://wa.me/628123456789?text=${encodeURIComponent(message)}`);
  });
});
