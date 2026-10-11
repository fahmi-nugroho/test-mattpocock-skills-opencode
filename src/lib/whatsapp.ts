/**
 * Build a wa.me deep link with a prefilled message.
 * The number is normalised to digits only (leading "+" / spaces /
 * dashes stripped) so stored formats like "+62 812-..." still work.
 */
export function buildWaLink(number: string, template: string): string {
  const digits = number.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(template)}`;
}

/**
 * Ticket 03 ID copy: general chat starter (no date prefill — date/time
 * is negotiated in chat) and per-service prefill "Halo, mau tanya [service]".
 */
export const GENERAL_WA_MESSAGE =
  "Halo, mau tanya jadwal makeup";

export function buildServiceWaMessage(serviceName: string): string {
  return `Halo, mau tanya ${serviceName}`;
}

export function buildServiceWaLink(
  number: string,
  serviceName: string,
): string {
  return buildWaLink(number, buildServiceWaMessage(serviceName));
}

export function buildGeneralWaLink(number: string): string {
  return buildWaLink(number, GENERAL_WA_MESSAGE);
}
