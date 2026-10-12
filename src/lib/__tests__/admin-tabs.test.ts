import { describe, expect, it } from "vitest";
import { ADMIN_TABS, parseAdminTab } from "../admin/admin-tabs";

// Seam (pure): location.hash → admin tab id, fallback 'ringkasan'.
// Catches unknown/empty hashes. Misses sticky-bar rendering/scroll.
describe("parseAdminTab", () => {
  it("maps known hashes to tab ids", () => {
    expect(parseAdminTab("#ringkasan")).toBe("ringkasan");
    expect(parseAdminTab("#kalender")).toBe("kalender");
    expect(parseAdminTab("#booking")).toBe("booking");
    expect(parseAdminTab("#blokir")).toBe("blokir");
    expect(parseAdminTab("#portfolio")).toBe("portfolio");
    expect(parseAdminTab("#harga")).toBe("harga");
    expect(parseAdminTab("#pengaturan")).toBe("pengaturan");
  });

  it("falls back to ringkasan for empty or unknown hashes", () => {
    expect(parseAdminTab("")).toBe("ringkasan");
    expect(parseAdminTab("#tidak-ada")).toBe("ringkasan");
    expect(parseAdminTab("#BOOKING")).toBe("ringkasan");
  });

  it("exposes seven tabs in bar order", () => {
    expect(ADMIN_TABS.map((t) => t.id)).toEqual([
      "ringkasan",
      "kalender",
      "booking",
      "blokir",
      "portfolio",
      "harga",
      "pengaturan",
    ]);
  });
});
