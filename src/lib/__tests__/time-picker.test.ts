import { describe, expect, it } from "vitest";
import { validatePickerRange } from "../time-picker";

// Seam (pure): picker start/end + shown occupied -> hint/order/overlap/valid.
// Catches order and half-open overlap verdicts. Misses component wiring.
describe("validatePickerRange", () => {
  it("returns hint when start or end is empty", () => {
    expect(validatePickerRange("", "", [])).toBe("hint");
    expect(validatePickerRange("10:00", "", [])).toBe("hint");
    expect(validatePickerRange("", "12:00", [])).toBe("hint");
  });

  it("returns order when end is not after start", () => {
    expect(validatePickerRange("12:00", "10:00", [])).toBe("order");
    expect(validatePickerRange("10:00", "10:00", [])).toBe("order");
  });

  it("returns overlap when the range overlaps a booked range", () => {
    expect(
      validatePickerRange("09:00", "11:00", [
        { start: "10:00", end: "12:00", kind: "booked" },
      ]),
    ).toBe("overlap");
  });

  it("returns overlap when the range overlaps a blocked range", () => {
    expect(
      validatePickerRange("09:00", "11:00", [
        { start: "10:00", end: "12:00", kind: "blocked" },
      ]),
    ).toBe("overlap");
  });

  it("returns overlap when the chosen range is contained in an occupied range", () => {
    expect(
      validatePickerRange("10:30", "11:00", [
        { start: "10:00", end: "12:00", kind: "booked" },
      ]),
    ).toBe("overlap");
  });

  it("returns overlap when the chosen range contains an occupied range", () => {
    expect(
      validatePickerRange("09:00", "13:00", [
        { start: "10:00", end: "11:00", kind: "booked" },
      ]),
    ).toBe("overlap");
  });

  it("allows touching edges (half-open, no overlap)", () => {
    expect(
      validatePickerRange("10:00", "11:00", [
        { start: "09:00", end: "10:00", kind: "booked" },
      ]),
    ).toBe("valid");
    expect(
      validatePickerRange("09:00", "10:00", [
        { start: "10:00", end: "11:00", kind: "blocked" },
      ]),
    ).toBe("valid");
  });

  it("returns valid for a disjoint non-overlapping range", () => {
    expect(
      validatePickerRange("11:00", "12:00", [
        { start: "09:00", end: "10:00", kind: "booked" },
      ]),
    ).toBe("valid");
  });

  it("returns valid on an empty day", () => {
    expect(validatePickerRange("10:00", "12:00", [])).toBe("valid");
  });

  it("checks every shown range, not just the first", () => {
    expect(
      validatePickerRange("14:00", "15:00", [
        { start: "09:00", end: "10:00", kind: "booked" },
        { start: "14:30", end: "15:30", kind: "blocked" },
      ]),
    ).toBe("overlap");
  });
});
