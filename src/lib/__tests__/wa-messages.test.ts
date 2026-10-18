import { describe, expect, it } from "vitest";
import {
  GENERAL_WA_MESSAGE,
  buildDateTimeWaLink,
  buildDateTimeWaMessage,
  buildDateWaLink,
  buildDateWaMessage,
  buildFormatBookingWaLink,
  buildFormatBookingWaMessage,
  buildGeneralWaLink,
  buildServiceWaLink,
  buildServiceWaMessage,
} from "../whatsapp";

describe("WA message templates (ticket 03, ID copy, no date prefill)", () => {
  it("exposes a general chat message", () => {
    expect(GENERAL_WA_MESSAGE).toMatch(/Halo/);
    expect(GENERAL_WA_MESSAGE).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("builds a per-service message with the service name", () => {
    expect(buildServiceWaMessage("Makeup Wisuda")).toBe(
      "Halo, mau tanya Makeup Wisuda",
    );
  });

  it("builds a per-service wa.me link with encoded service name", () => {
    expect(buildServiceWaLink("6281234567890", "Makeup Wisuda")).toBe(
      "https://wa.me/6281234567890?text=Halo%2C%20mau%20tanya%20Makeup%20Wisuda",
    );
  });

  it("builds a general wa.me link from the shared template", () => {
    expect(buildGeneralWaLink("6281234567890")).toBe(
      `https://wa.me/6281234567890?text=${encodeURIComponent(GENERAL_WA_MESSAGE)}`,
    );
  });

  it("builds a per-date message with the date only (no time prefill)", () => {
    expect(buildDateWaMessage("2026-10-15")).toBe(
      "Halo, mau tanya jadwal makeup tanggal 2026-10-15",
    );
  });

  it("builds a per-date wa.me link with encoded date", () => {
    expect(buildDateWaLink("6281234567890", "2026-10-15")).toBe(
      `https://wa.me/6281234567890?text=${encodeURIComponent(
        "Halo, mau tanya jadwal makeup tanggal 2026-10-15",
      )}`,
    );
  });
});

describe("date-plus-time WA message (ticket 03, picker prefill)", () => {
  it("appends the chosen start-end range to the date message", () => {
    expect(buildDateTimeWaMessage("2026-10-15", "10:00", "12:00")).toBe(
      "Halo, mau tanya jadwal makeup tanggal 2026-10-15 jam 10:00-12:00",
    );
  });

  it("keeps the date-only message byte-identical as its prefix", () => {
    const withTime = buildDateTimeWaMessage("2026-10-15", "10:00", "12:00");
    expect(withTime.startsWith(buildDateWaMessage("2026-10-15"))).toBe(true);
  });

  it("builds a wa.me link with the encoded date-plus-time message", () => {
    expect(
      buildDateTimeWaLink("6281234567890", "2026-10-15", "10:00", "12:00"),
    ).toBe(
      `https://wa.me/6281234567890?text=${encodeURIComponent(
        "Halo, mau tanya jadwal makeup tanggal 2026-10-15 jam 10:00-12:00",
      )}`,
    );
  });

  it("normalises the number to digits only", () => {
    expect(
      buildDateTimeWaLink("+62 812-3456-7890", "2026-10-15", "10:00", "12:00"),
    ).toBe(
      `https://wa.me/6281234567890?text=${encodeURIComponent(
        "Halo, mau tanya jadwal makeup tanggal 2026-10-15 jam 10:00-12:00",
      )}`,
    );
  });
});

describe("Format Booking WA message (ticket 04, admin sends the link)", () => {
  const LINK = "https://mua.example.com/request/abc123";

  it("carries the link in an Indonesian message", () => {
    expect(buildFormatBookingWaMessage(LINK)).toBe(
      `Halo, silakan isi format booking lewat link ini: ${LINK}`,
    );
  });

  it("builds a wa.me link with the encoded Format Booking message", () => {
    expect(buildFormatBookingWaLink("6281234567890", LINK)).toBe(
      `https://wa.me/6281234567890?text=${encodeURIComponent(
        `Halo, silakan isi format booking lewat link ini: ${LINK}`,
      )}`,
    );
  });

  it("normalises a stored number to digits only", () => {
    expect(buildFormatBookingWaLink("+62 812-3456-7890", LINK)).toBe(
      `https://wa.me/6281234567890?text=${encodeURIComponent(
        `Halo, silakan isi format booking lewat link ini: ${LINK}`,
      )}`,
    );
  });
});
