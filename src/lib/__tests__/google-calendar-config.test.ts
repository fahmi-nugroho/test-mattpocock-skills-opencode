import { describe, expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import {
  GOOGLE_CONFIG_ERROR,
  GOOGLE_PRIVATE_KEY_ERROR,
  loadGoogleCalendarConfig,
  normalisePrivateKey,
} from "../google/config";

// Seam (pure config): turns server env values into a usable service-account
// config. Catches missing values and an escaped/malformed private key before
// any Google call. Misses live Google authentication.
function validPem(): string {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return privateKey;
}

const ENV = {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: "mirror@mua.iam.gserviceaccount.com",
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: validPem().replace(/\n/g, "\\n"),
  GOOGLE_CALENDAR_ID: "mua-booking@group.calendar.google.com",
};

describe("loadGoogleCalendarConfig", () => {
  it("normalises escaped newlines so the key can sign", () => {
    const config = loadGoogleCalendarConfig(ENV);
    expect(config.serviceAccountEmail).toBe(ENV.GOOGLE_SERVICE_ACCOUNT_EMAIL);
    expect(config.calendarId).toBe(ENV.GOOGLE_CALENDAR_ID);
    expect(config.privateKey).toContain("\n");
    expect(config.privateKey).not.toContain("\\n");
  });

  it("reports a plain Indonesian error for every missing value", () => {
    for (const key of [
      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
      "GOOGLE_CALENDAR_ID",
    ]) {
      const env = { ...ENV, [key]: "" };
      expect(() => loadGoogleCalendarConfig(env)).toThrow(GOOGLE_CONFIG_ERROR);
    }
  });

  it("turns a malformed private key into an Indonesian configuration error", () => {
    const env = {
      ...ENV,
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
        "-----BEGIN PRIVATE KEY-----\\nbukan-kunci\\n-----END PRIVATE KEY-----",
    };
    expect(() => loadGoogleCalendarConfig(env)).toThrow(
      GOOGLE_PRIVATE_KEY_ERROR,
    );
    try {
      loadGoogleCalendarConfig(env);
    } catch (error) {
      // Never leak the raw OpenSSL decoder message to the admin.
      expect((error as Error).message).not.toMatch(/DECODER|asn1|openssl/i);
    }
  });
});

describe("normalisePrivateKey", () => {
  it("converts literal backslash-n sequences to real newlines", () => {
    expect(normalisePrivateKey("a\\nb\\nc")).toBe("a\nb\nc");
  });
});
