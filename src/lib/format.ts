/** Format an amount as IDR with no decimals, e.g. "Rp 150.000". */
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format a "YYYY-MM-DD" date in id-ID, e.g. "Senin, 12 Oktober 2026". */
export function formatDateId(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Format a "YYYY-MM-DD" date in English months, e.g. "20 October 2026". */
export function formatDateEn(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Format a server ISO timestamp in WIB, e.g. "22 Okt 2026, 10.04". */
export function formatDateTimeId(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}
