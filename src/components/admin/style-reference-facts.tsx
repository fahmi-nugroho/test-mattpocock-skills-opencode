import { isStyle, STYLE_COPY } from "@/lib/style-reference";

/**
 * The Style and Reference facts an admin list row shows
 * (booking-request-style-and-reference ticket 04). One home for the rule so the
 * Permintaan list and the Bookings list cannot drift.
 *
 * A row from before the change keeps the free text it holds and shows it
 * read-only here: it sits in the reused column, so the list can still show it
 * even though the radio cannot re-select it. An empty Reference is absent
 * rather than an empty label, and the whole line disappears when both are empty.
 */
export function StyleReferenceFacts({
  hairdo,
  reference,
}: {
  hairdo: string;
  reference: string;
}) {
  const style = isStyle(hairdo) ? STYLE_COPY[hairdo].label : hairdo;
  if (!style && !reference) return null;
  return (
    <p className="mt-0.5 text-xs text-neutral-600">
      {style ? `Gaya: ${style}` : ""}
      {style && reference ? " · " : ""}
      {reference ? `Referensi: ${reference}` : ""}
    </p>
  );
}
