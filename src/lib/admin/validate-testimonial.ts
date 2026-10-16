import { assertNonNegativeInt } from "./form-number";

export interface TestimonialInput {
  quote: string;
  client_name: string;
  sort: number;
  visible: boolean;
}

/**
 * Validate the admin testimonial form (ticket 02).
 * Trims quote/client name so landing cards stay clean; quote mirrors
 * the `1-300 char` DB CHECK, sort mirrors the `sort >= 0` ordering the
 * public list relies on. Text-only — no markdown rendering on landing.
 */
export function validateTestimonialInput(
  input: TestimonialInput,
): TestimonialInput {
  const quote = input.quote.trim();
  if (!quote) {
    throw new Error("Kutipan testimoni tidak boleh kosong");
  }
  if (quote.length > 300) {
    throw new Error("Kutipan testimoni maksimal 300 karakter");
  }
  const client_name = input.client_name.trim();
  if (!client_name) {
    throw new Error("Nama klien tidak boleh kosong");
  }
  const sort = assertNonNegativeInt(input.sort, "Urutan");
  return { quote, client_name, sort, visible: input.visible };
}
