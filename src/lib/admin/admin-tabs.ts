/**
 * Admin dashboard tab ids + hash mapping (ticket 06). Pure: maps
 * `window.location.hash` to a tab id with 'ringkasan' fallback. The
 * page component owns the hashchange listener and sticky bar; sections
 * carry matching ids + scroll-mt for the sticky offset.
 */
export const ADMIN_TABS = [
  { id: "ringkasan", label: "Ringkasan" },
  { id: "kalender", label: "Kalender" },
  { id: "booking", label: "Booking" },
  { id: "blokir", label: "Blokir" },
  { id: "portfolio", label: "Portfolio" },
  { id: "harga", label: "Harga" },
  { id: "pengaturan", label: "Pengaturan" },
] as const;

export type AdminTabId = (typeof ADMIN_TABS)[number]["id"];

const TAB_IDS = new Set<string>(ADMIN_TABS.map((t) => t.id));

export function parseAdminTab(hash: string): AdminTabId {
  const id = hash.startsWith("#") ? hash.slice(1) : hash;
  return TAB_IDS.has(id) ? (id as AdminTabId) : "ringkasan";
}
