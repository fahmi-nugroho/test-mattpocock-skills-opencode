/**
 * The Style choice and the Reference cap shared by the public submit validator
 * (src/lib/booking-request.ts) and the admin booking validator
 * (src/lib/admin/validate-booking.ts) — booking-request-style-and-reference
 * ticket 02. Pure: no React, no Supabase.
 *
 * Style reuses the column the hairstyle already occupies, so the two-value rule
 * lives here and in `submit_booking_request` (0017), never in a schema CHECK:
 * that column already holds free text on rows that predate this change, and a
 * CHECK would collide with it. '' keeps meaning "not known" for legacy rows and
 * the admin's optional field.
 */

/** The two Style values: a Hijabdo (over a hijab) or a Hairdo (open hair). */
export const STYLE_VALUES = ["hijabdo", "hairdo"] as const;

export type Style = (typeof STYLE_VALUES)[number];

/** The Reference cap, mirrored from the 0017 migration. */
export const REFERENCE_MAX = 300;

/** True when a value is exactly one of the two Style values (untrimmed). */
export function isStyle(value: unknown): value is Style {
  return (
    typeof value === "string" &&
    (STYLE_VALUES as readonly string[]).includes(value)
  );
}
