import { describe, expect, it } from "vitest";
import { validateStatInput } from "../admin/validate-stat";

// Seam (pure): stat form validation with known-good literals.
// Catches blank/overlong value/label and bad sort before a DB write.
// Misses live DB CHECKs.
describe("validateStatInput", () => {
  it("accepts a valid stat", () => {
    expect(
      validateStatInput({
        value: "10+ Tahun",
        label: "Pengalaman",
        sort: 0,
        visible: true,
      }),
    ).toEqual({
      value: "10+ Tahun",
      label: "Pengalaman",
      sort: 0,
      visible: true,
    });
  });

  it("trims value and label", () => {
    expect(
      validateStatInput({
        value: "  500+  ",
        label: "  Klien  ",
        sort: 1,
        visible: true,
      }),
    ).toEqual({ value: "500+", label: "Klien", sort: 1, visible: true });
  });

  it("rejects a blank value", () => {
    expect(() =>
      validateStatInput({ value: "   ", label: "Klien", sort: 0, visible: true }),
    ).toThrow(/value|nilai/i);
  });

  it("rejects a blank label", () => {
    expect(() =>
      validateStatInput({ value: "500+", label: "   ", sort: 0, visible: true }),
    ).toThrow(/label/i);
  });

  it("rejects value/label longer than 40 characters", () => {
    expect(() =>
      validateStatInput({
        value: "x".repeat(41),
        label: "Klien",
        sort: 0,
        visible: true,
      }),
    ).toThrow(/40/);
    expect(() =>
      validateStatInput({
        value: "500+",
        label: "x".repeat(41),
        sort: 0,
        visible: true,
      }),
    ).toThrow(/40/);
  });

  it("rejects a negative or non-integer sort", () => {
    expect(() =>
      validateStatInput({
        value: "500+",
        label: "Klien",
        sort: -1,
        visible: true,
      }),
    ).toThrow(/urut|sort/i);
    expect(() =>
      validateStatInput({
        value: "500+",
        label: "Klien",
        sort: 1.5,
        visible: true,
      }),
    ).toThrow(/urut|sort/i);
  });
});
