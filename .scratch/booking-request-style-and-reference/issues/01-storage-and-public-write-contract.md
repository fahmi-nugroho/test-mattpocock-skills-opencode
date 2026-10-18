# 01: Style and Reference storage and the public write contract

**Spec:** [booking-request-style-and-reference/spec.md](../spec.md)

**What to build:** The storage and the public write contract that the rest of the feature stands on, end to end. A forward migration adds one `reference` column (text, not null, defaulting to `''`, capped at 300 characters) to **both** the booking table and the request table — the Reference is a link or a short written description of the look the client wants. The Style gets no new column: it reuses the column the hairstyle already occupies, whose meaning narrows from free text to one of exactly two values, `hijabdo` or `hairdo` (plus `''` for "not known", which only legacy rows and the admin's optional field can hold).

The public `submit_booking_request` function's payload gains one optional key (`reference`, at most 300 characters) and its existing hairstyle key becomes **required** and must be exactly one of the two Style values; a missing, empty, or unrecognised Style is refused as an invalid payload, exactly as a malformed phone number is today. The function still writes only the client-owned columns and still sets the submission timestamp. The two TypeScript row types gain `reference`.

The declarative migration-contract test is extended to assert the new column on both tables, the new payload key, the Style rule inside the submit function, and the new column in the submit function's SET clause — no live database.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Given the migration is applied, both the booking table and the request table have a non-null `reference` column defaulting to `''`.
- [x] Given a raw public payload whose style is missing, empty, or neither `hijabdo` nor `hairdo`, the submit function refuses it as an invalid payload and writes nothing.
- [x] Given a raw public payload with a valid Style and a Reference of up to 300 characters, the submit function accepts it and stores both.
- [x] Given a raw public payload with a Reference over 300 characters, the submit function refuses it as an invalid payload.
- [x] Given the submit function, it writes only the client-owned columns plus the submission timestamp — never a price, status, token, or accepted-booking link.
- [x] Given a row that predates the change, it keeps its text and the new column is safe on it.
- [x] Given the migration files on disk, the declarative contract test asserts the new column on both tables, the new payload key, the required-two-value Style rule, and the new column in the SET clause.
- [x] Given a token held by a stranger, the public read function returns nothing new — the Style and Reference stay client-owned and are never exposed.

## Comments

- 2026-10-18 — Resolved on `feat/booking-request-intake-spec`.
  - Feature commit `1b4c573`.
  - Added `supabase/migrations/0017_style_and_reference.sql`: a forward migration that adds `reference text not null default ''` to `bookings` and `booking_requests`, and replaces `submit_booking_request` so the Style (`hairdo`) is required and exactly `'hijabdo'` or `'hairdo'`, the optional `reference` key is capped at 300 characters, and `reference` joins the client-owned SET clause. The two-value rule stays out of the schema (no CHECK) so legacy free text in the reused column cannot collide; the guarded, race-safe update is carried over from 0016.
  - Gave `reference` to both row types in `src/lib/supabase/database.ts`, and updated the hand-built request fixture in `booking-request-admin.test.ts`.
  - Extended the declarative migration-contract test in `src/lib/__tests__/schema.test.ts` for the new column on both tables, the required two-value Style rule (compared exactly, not trimmed), the 300-character Reference cap, the SET clause, and the untouched public read contract; the 0016 read test's negative sweep now also forbids `hairdo`/`reference`.
  - Code review (standards + spec axes): no hard violations, no missing requirements, no scope creep; the one fix applied was matching the repo's exact (untrimmed) enum handling for the Style.
