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
  const id = hash.replace(/^#/, "").split("?")[0];
  return TAB_IDS.has(id) ? (id as AdminTabId) : "ringkasan";
}

export function parseAdminQueue(hash: string) {
  const tab = parseAdminTab(hash);
  const params = new URLSearchParams(hash.split("?")[1]);
  const filter = params.get("filter");
  const day = params.get("date");
  const parsedDay = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T00:00:00Z`) : null;
  const date = parsedDay && Number.isFinite(parsedDay.getTime()) && parsedDay.toISOString().slice(0, 10) === day ? day : "";
  return {
    bookings: tab === "booking" && filter === "pending" ? "pending" as const : "all" as const,
    requests: tab === "permintaan" && filter === "needs_action" ? "needs_action" as const : "all" as const,
    date: tab === "booking" ? date : "",
  };
}
