/** Indonesian copy for a failed admin sign-in (ticket 06-admin-nav). */
export const LOGIN_INVALID_CREDENTIALS =
  "Email atau kata sandi salah. Coba lagi.";
export const LOGIN_NETWORK_ERROR =
  "Tidak dapat terhubung. Periksa koneksi lalu coba lagi.";

/**
 * Maps a Supabase sign-in failure to Indonesian error copy. Network
 * failures (fetch aborts/timeouts) get the connectivity message;
 * everything else falls back to the invalid-credentials message so no
 * account detail leaks. Pure — empty fields are already handled by the
 * form's native `required` validation before this runs.
 */
export function mapSignInError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : "";
  if (/failed to fetch|network|load failed|timeout|abort/i.test(message)) {
    return LOGIN_NETWORK_ERROR;
  }
  return LOGIN_INVALID_CREDENTIALS;
}
