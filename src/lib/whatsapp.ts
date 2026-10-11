/**
 * Build a wa.me deep link with a prefilled message.
 * The number is normalised to digits only (leading "+" / spaces /
 * dashes stripped) so stored formats like "+62 812-..." still work.
 */
export function buildWaLink(number: string, template: string): string {
  const digits = number.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(template)}`;
}
