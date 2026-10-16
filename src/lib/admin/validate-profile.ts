export interface ProfileInput {
  headline: string;
  subcopy: string;
  portrait_url: string | null;
}

/**
 * Validate the admin profil form (ticket 03). Trims headline/subcopy so
 * the hero stays clean; headline mirrors the `<= 120 char` DB CHECK,
 * subcopy mirrors `<= 300 char`, portrait mirrors the HTTPS URL rule
 * (empty stays null so the portfolio-cover fallback applies).
 */
export function validateProfileInput(input: {
  headline: string;
  subcopy: string;
  portrait_url: string | null;
}): ProfileInput {
  const headline = input.headline.trim();
  if (!headline) {
    throw new Error("Headline profil tidak boleh kosong");
  }
  if (headline.length > 120) {
    throw new Error("Headline profil maksimal 120 karakter");
  }
  const subcopy = input.subcopy.trim();
  if (!subcopy) {
    throw new Error("Subcopy profil tidak boleh kosong");
  }
  if (subcopy.length > 300) {
    throw new Error("Subcopy profil maksimal 300 karakter");
  }
  const rawPortrait = (input.portrait_url ?? "").trim();
  if (!rawPortrait) {
    return { headline, subcopy, portrait_url: null };
  }
  if (!rawPortrait.startsWith("https://") || rawPortrait.length > 2048) {
    throw new Error("Portrait harus berupa URL gambar HTTPS");
  }
  return { headline, subcopy, portrait_url: rawPortrait };
}
