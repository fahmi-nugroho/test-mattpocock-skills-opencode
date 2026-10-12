import { describe, expect, it } from "vitest";
import {
  LOGIN_INVALID_CREDENTIALS,
  LOGIN_NETWORK_ERROR,
  mapSignInError,
} from "../login-errors";

describe("mapSignInError", () => {
  it("maps invalid credentials to the Indonesian retry copy", () => {
    expect(mapSignInError({ message: "Invalid login credentials" })).toBe(
      LOGIN_INVALID_CREDENTIALS,
    );
    expect(LOGIN_INVALID_CREDENTIALS).toBe(
      "Email atau kata sandi salah. Coba lagi.",
    );
  });

  it("falls back to the invalid-credentials copy for unknown errors", () => {
    expect(mapSignInError({ message: "Something broke" })).toBe(
      LOGIN_INVALID_CREDENTIALS,
    );
    expect(mapSignInError(null)).toBe(LOGIN_INVALID_CREDENTIALS);
    expect(mapSignInError(undefined)).toBe(LOGIN_INVALID_CREDENTIALS);
  });

  it("maps fetch failures to the Indonesian network copy", () => {
    expect(mapSignInError(new TypeError("Failed to fetch"))).toBe(
      LOGIN_NETWORK_ERROR,
    );
    expect(mapSignInError({ message: "Network request failed" })).toBe(
      LOGIN_NETWORK_ERROR,
    );
    expect(LOGIN_NETWORK_ERROR).toBe(
      "Tidak dapat terhubung. Periksa koneksi lalu coba lagi.",
    );
  });
});
