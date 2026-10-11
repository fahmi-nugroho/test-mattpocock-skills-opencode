/**
 * Parse a required numeric admin form field (ticket 06).
 * Blank inputs must throw: Number("") === 0 would otherwise slip past
 * the >= 0 range checks and silently create e.g. a Rp 0 price.
 * Range/integer rules stay in validatePortfolioInput/validateServiceInput.
 */
export function parseRequiredNumber(raw: string, label: string): number {
  if (raw.trim() === "") {
    throw new Error(`${label} wajib diisi`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`${label} tidak valid`);
  }
  return n;
}
