import { describe, expect, it } from "vitest";
import { validateTestimonialInput } from "../admin/validate-testimonial";

// Seam (pure): testimonial form validation with known-good literals.
// Catches blank quote/client name, overlong quote, bad sort before a DB
// write. Misses live DB CHECKs.
describe("validateTestimonialInput", () => {
  it("accepts a valid testimonial", () => {
    expect(
      validateTestimonialInput({
        quote: "Riasannya natural tapi tahan lama.",
        client_name: "Dinda, Pengantin",
        sort: 0,
        visible: true,
      }),
    ).toEqual({
      quote: "Riasannya natural tapi tahan lama.",
      client_name: "Dinda, Pengantin",
      sort: 0,
      visible: true,
    });
  });

  it("trims quote and client name", () => {
    expect(
      validateTestimonialInput({
        quote: "  Bagus sekali  ",
        client_name: "  Salsa  ",
        sort: 1,
        visible: true,
      }),
    ).toEqual({
      quote: "Bagus sekali",
      client_name: "Salsa",
      sort: 1,
      visible: true,
    });
  });

  it("rejects a blank quote", () => {
    expect(() =>
      validateTestimonialInput({
        quote: "   ",
        client_name: "Dinda",
        sort: 0,
        visible: true,
      }),
    ).toThrow(/quote|kutipan|testimoni/i);
  });

  it("rejects a blank client name", () => {
    expect(() =>
      validateTestimonialInput({
        quote: "Bagus sekali",
        client_name: "   ",
        sort: 0,
        visible: true,
      }),
    ).toThrow(/nama|klien|client/i);
  });

  it("rejects a quote longer than 300 characters", () => {
    expect(() =>
      validateTestimonialInput({
        quote: "x".repeat(301),
        client_name: "Dinda",
        sort: 0,
        visible: true,
      }),
    ).toThrow(/300/);
  });

  it("rejects a negative or non-integer sort", () => {
    expect(() =>
      validateTestimonialInput({
        quote: "Bagus sekali",
        client_name: "Dinda",
        sort: -1,
        visible: true,
      }),
    ).toThrow(/urut|sort/i);
    expect(() =>
      validateTestimonialInput({
        quote: "Bagus sekali",
        client_name: "Dinda",
        sort: 1.5,
        visible: true,
      }),
    ).toThrow(/urut|sort/i);
  });
});
