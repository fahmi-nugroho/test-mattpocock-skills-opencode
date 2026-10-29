/**
 * Id tab + pemetaan hash dashboard admin (tiket 06). Murni: memetakan
 * `window.location.hash` ke id tab dengan fallback 'ringkasan'.
 * Komponen halaman memegang listener hashchange dan navigasi tab; tab
 * mengganti panel yang tampil (bukan menggulir ke section), dan hash tetap
 * dipakai agar tautan dalam/reload mendarat di panel yang sama.
 */
export const ADMIN_TABS = [
  { id: "ringkasan", label: "Ringkasan" },
  { id: "kalender", label: "Kalender" },
  { id: "booking", label: "Booking" },
  { id: "permintaan", label: "Permintaan" },
  { id: "blokir", label: "Blokir" },
  { id: "portfolio", label: "Portfolio" },
  { id: "harga", label: "Harga" },
  { id: "profil-testimoni", label: "Profil & Testimoni" },
  { id: "pengaturan", label: "Pengaturan" },
] as const;

export type AdminTabId = (typeof ADMIN_TABS)[number]["id"];

const TAB_IDS = new Set<string>(ADMIN_TABS.map((t) => t.id));

export function parseAdminTab(hash: string): AdminTabId {
  const id = hash.startsWith("#") ? hash.slice(1) : hash;
  return TAB_IDS.has(id) ? (id as AdminTabId) : "ringkasan";
}
