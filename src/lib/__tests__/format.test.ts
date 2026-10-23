import { describe, expect, it } from "vitest";
import { formatDateId, formatDateTimeId, formatIDR } from "../format";

describe("formatIDR", () => {
  it("formats an amount in IDR without decimals", () => {
    const out = formatIDR(150000).replace(/\u00a0/g, " ");
    expect(out).toMatch(/Rp/);
    expect(out).toMatch(/150\.000/);
  });

  it("formats zero", () => {
    expect(formatIDR(0).replace(/\u00a0/g, " ")).toMatch(/0/);
  });
});

describe("formatDateId", () => {
  it("formats a YYYY-MM-DD date in id-ID", () => {
    // 12 Oct 2026 is a Monday (Senin)
    const out = formatDateId("2026-10-12");
    expect(out).toMatch(/12/);
    expect(out).toMatch(/Oktober/i);
    expect(out).toMatch(/2026/);
  });
});

describe("formatDateTimeId", () => {
  it("renders a server timestamp in WIB", () => {
    const out = formatDateTimeId("2026-10-22T03:04:05.000Z");
    expect(out).toMatch(/22/);
    expect(out).toMatch(/Okt/i);
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/10[.:]04/);
  });
});
