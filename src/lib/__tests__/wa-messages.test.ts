import { describe, expect, it } from "vitest";
import {
  GENERAL_WA_MESSAGE,
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
});
