/**
 * Client-side substring filter for admin list search (ticket 06). Pure:
 * no Supabase, no RLS — managers pass a field picker over the visible
 * text fields and render the returned subset. Empty query returns all.
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
