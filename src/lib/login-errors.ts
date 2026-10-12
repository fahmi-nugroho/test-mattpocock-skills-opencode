/** Indonesian copy for a failed admin sign-in (ticket 06-admin-nav). */
export const LOGIN_INVALID_CREDENTIALS =
  "Email atau kata sandi salah. Coba lagi.";
export const LOGIN_NETWORK_ERROR =
  "Tidak dapat terhubung. Periksa koneksi lalu coba lagi.";

/**
 * Memetakan kegagalan sign-in Supabase ke salinan error Bahasa
 * Indonesia. Kegagalan jaringan (fetch abort/timeout) memakai pesan
 * konektivitas; sisanya fallback ke pesan kredensial salah agar tidak
 * membocorkan detail akun. Murni — field kosong sudah ditangani
 * validasi `required` bawaan form sebelum ini berjalan.
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
