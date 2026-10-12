import { describe, expect, it } from "vitest";
import { validateSettingsInput } from "../admin/validate-settings";

// Seam 1 (pure): WA-only settings form validation with known-good literals.
// Catches bad WA before a DB write. Misses live DB CHECKs. Hours validation
// was removed with the operating window (hours-removal contract): the form
// carries wa_number only.
describe("validateSettingsInput", () => {
  it("accepts a valid WA number", () => {
    expect(
      validateSettingsInput({ wa_number: "6281234567890" }),
    ).toEqual({ wa_number: "6281234567890" });
  });

  it("normalises formatted WA numbers to digits only", () => {
    expect(
      validateSettingsInput({ wa_number: "+62 812-3456-7890" }),
    ).toEqual({ wa_number: "6281234567890" });
  });

  it("rejects a blank WA number instead of saving a broken contact link", () => {
    expect(() => validateSettingsInput({ wa_number: "   " })).toThrow(/wa/i);
  });

  it("rejects a too-short WA number", () => {
    expect(() => validateSettingsInput({ wa_number: "62812" })).toThrow(/wa/i);
  });

  it("ignores stray hours keys instead of persisting them", () => {
    expect(
      validateSettingsInput({
        wa_number: "6281234567890",
        open_hour: "09:00",
        close_hour: "19:00",
      } as unknown as { wa_number: string }),
    ).toEqual({ wa_number: "6281234567890" });
  });
});
