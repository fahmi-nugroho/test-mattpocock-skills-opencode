import { describe, expect, it } from "vitest";
import { buildWaLink } from "../whatsapp";

describe("buildWaLink", () => {
  it("builds a wa.me link for a general message", () => {
    expect(buildWaLink("6281234567890", "Halo, mau tanya jadwal")).toBe(
      "https://wa.me/6281234567890?text=Halo%2C%20mau%20tanya%20jadwal",
    );
  });

  it("prefills a per-service message with the service name", () => {
    const link = buildWaLink("6281234567890", "Halo, mau tanya Makeup Wisuda");
    expect(link).toBe(
      "https://wa.me/6281234567890?text=Halo%2C%20mau%20tanya%20Makeup%20Wisuda",
    );
  });

  it("encodes special characters in the message", () => {
    expect(buildWaLink("6281234567890", "Halo & sampai jumpa?")).toBe(
      "https://wa.me/6281234567890?text=Halo%20%26%20sampai%20jumpa%3F",
    );
  });
});
