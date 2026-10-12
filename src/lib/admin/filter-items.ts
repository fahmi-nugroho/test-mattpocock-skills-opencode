/**
 * Filter substring sisi-klien untuk pencarian daftar admin (tiket 06).
 * Murni: tanpa Supabase/RLS — manager mengoper pemilih field atas
 * kolom teks yang terlihat lalu me-render subset hasilnya. Query kosong
 * mengembalikan semua.
 */
export function filterByQuery<T>(
  items: readonly T[],
  query: string,
  pick: (item: T) => readonly (string | null | undefined)[],
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter((item) =>
    pick(item).some((field) => (field ?? "").toLowerCase().includes(q)),
  );
}
