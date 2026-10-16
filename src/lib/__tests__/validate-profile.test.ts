import { describe, expect, it } from "vitest";
import { validateProfileInput } from "../admin/validate-profile";

// Seam (pure): profil form validation with known-good literals.
// Catches blank/overlong headline/subcopy and bad portrait URL before a
// DB write. Misses live DB CHECKs.
describe("validateProfileInput", () => {
  it("accepts a valid profil", () => {
    expect(
      validateProfileInput({
        headline: "Tampil memukau di hari spesialmu",
        subcopy: "Lihat portfolio lalu chat WhatsApp.",
        portrait_url: "https://example.com/portrait.jpg",
      }),
    ).toEqual({
      headline: "Tampil memukau di hari spesialmu",
      subcopy: "Lihat portfolio lalu chat WhatsApp.",
      portrait_url: "https://example.com/portrait.jpg",
    });
  });

  it("trims headline and subcopy", () => {
    expect(
      validateProfileInput({
        headline: "  Halo  ",
        subcopy: "  Deskripsi  ",
        portrait_url: null,
      }),
    ).toEqual({
      headline: "Halo",
      subcopy: "Deskripsi",
      portrait_url: null,
    });
  });

  it("accepts an empty portrait as null (fallback to portfolio cover)", () => {
    expect(
      validateProfileInput({
        headline: "Halo",
        subcopy: "Deskripsi",
        portrait_url: "",
      }),
    ).toEqual({ headline: "Halo", subcopy: "Deskripsi", portrait_url: null });
    expect(
      validateProfileInput({
        headline: "Halo",
        subcopy: "Deskripsi",
        portrait_url: null,
      }),
    ).toEqual({ headline: "Halo", subcopy: "Deskripsi", portrait_url: null });
  });

  it("rejects a blank headline", () => {
    expect(() =>
      validateProfileInput({
        headline: "   ",
        subcopy: "Deskripsi",
        portrait_url: null,
      }),
    ).toThrow(/headline/i);
  });

  it("rejects a headline longer than 120 characters", () => {
    expect(() =>
      validateProfileInput({
        headline: "x".repeat(121),
        subcopy: "Deskripsi",
        portrait_url: null,
      }),
    ).toThrow(/120/);
  });

  it("rejects a blank subcopy", () => {
    expect(() =>
      validateProfileInput({
        headline: "Halo",
        subcopy: "   ",
        portrait_url: null,
      }),
    ).toThrow(/subcopy|deskripsi/i);
  });

  it("rejects a subcopy longer than 300 characters", () => {
    expect(() =>
      validateProfileInput({
        headline: "Halo",
        subcopy: "x".repeat(301),
        portrait_url: null,
      }),
    ).toThrow(/300/);
  });

  it("rejects a non-HTTPS portrait URL", () => {
    expect(() =>
      validateProfileInput({
        headline: "Halo",
        subcopy: "Deskripsi",
        portrait_url: "http://example.com/a.jpg",
      }),
    ).toThrow(/https|portrait/i);
    expect(() =>
      validateProfileInput({
        headline: "Halo",
        subcopy: "Deskripsi",
        portrait_url: "bukan-url",
      }),
    ).toThrow(/https|portrait/i);
  });
});
