import { describe, expect, it } from "vitest";
import { normaliseInstagramHandle } from "../instagram";

// Seam 1 (pure): one rule shared by the settings form and the Invoice picture,
// so the stored handle and the printed handle can never disagree about a
// leading @. Misses whether the handle is a real account.
describe("normaliseInstagramHandle", () => {
  it("strips a leading @ and surrounding blanks", () => {
    expect(normaliseInstagramHandle("  @wandanamakeup ")).toBe(
      "wandanamakeup",
    );
  });

  it("keeps an already-clean handle unchanged", () => {
    expect(normaliseInstagramHandle("wandanamakeup")).toBe("wandanamakeup");
  });

  it("keeps an empty handle empty so the invoice can print an em dash", () => {
    expect(normaliseInstagramHandle("   ")).toBe("");
    expect(normaliseInstagramHandle("@")).toBe("");
  });
});
