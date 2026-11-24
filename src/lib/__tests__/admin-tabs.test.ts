import { describe, expect, it } from "vitest";
import { ADMIN_TABS, parseAdminQueue, parseAdminTab } from "../admin/admin-tabs";

// Seam (pure): location.hash → admin tab id, fallback 'ringkasan'.
// Catches unknown/empty hashes. Misses sticky-bar rendering/scroll.
describe("parseAdminTab", () => {
  it("keeps the tab and scope of queue links", () => {
    expect(parseAdminTab("#permintaan?filter=needs_action")).toBe("permintaan");
    expect(parseAdminQueue("#permintaan?filter=needs_action").requests).toBe("needs_action");
    expect(parseAdminQueue("#booking?filter=pending").bookings).toBe("pending");
    expect(parseAdminQueue("#booking?date=2026-11-24").date).toBe("2026-11-24");
    expect(parseAdminQueue("#booking?date=2026-02-31").date).toBe("");
    expect(parseAdminQueue("#kalender?filter=pending&date=2026-11-24")).toEqual({ bookings: "all", requests: "all", date: "" });
  });
  it("maps known hashes to tab ids", () => {
    expect(parseAdminTab("#ringkasan")).toBe("ringkasan");
    expect(parseAdminTab("#kalender")).toBe("kalender");
    expect(parseAdminTab("#booking")).toBe("booking");
    expect(parseAdminTab("#permintaan")).toBe("permintaan");
    expect(parseAdminTab("#blokir")).toBe("blokir");
    expect(parseAdminTab("#portfolio")).toBe("portfolio");
    expect(parseAdminTab("#harga")).toBe("harga");
    expect(parseAdminTab("#profil-testimoni")).toBe("profil-testimoni");
    expect(parseAdminTab("#pengaturan")).toBe("pengaturan");
  });

  it("falls back to ringkasan for empty or unknown hashes", () => {
    expect(parseAdminTab("")).toBe("ringkasan");
    expect(parseAdminTab("#tidak-ada")).toBe("ringkasan");
    expect(parseAdminTab("#BOOKING")).toBe("ringkasan");
  });

  it("exposes nine tabs in bar order", () => {
    expect(ADMIN_TABS.map((t) => t.id)).toEqual([
      "ringkasan",
      "kalender",
      "booking",
      "permintaan",
      "blokir",
      "portfolio",
      "harga",
      "profil-testimoni",
      "pengaturan",
    ]);
  });
});
