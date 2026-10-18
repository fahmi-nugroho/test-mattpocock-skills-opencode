# 01: Schema foundation for requests and the new booking fields

**What to build:** A forward migration creating the `booking_requests` table and adding the six new columns to `bookings`, with the matching policies and a token that cannot be guessed. Extend the existing declarative migration contract test to cover it.

**Blocked by:** nothing.

**Status:** needs-triage

- [ ] Given the migration is applied, `bookings` has `event_type`, `headcount`, `venue`, `hairdo` (non-null with sensible defaults), `total_price` (nullable) and `dp_amount` (non-null default `0`), each constrained as specified.
- [ ] Given the migration is applied, `booking_requests` exists with the token, the three bookkeeping timestamps, the client fields, the requested slot, and `accepted_booking_id` referencing bookings and unique.
- [ ] Given two requests are created without a supplied token, each receives a different database-generated 128-bit value, and the row id never leaks as the token.
- [ ] Given the anonymous role, it cannot select, insert, update, or delete `booking_requests` directly; given the authenticated role, it can do all four as with the existing tables.
- [ ] Given the migration files on disk, the declarative SQL verify test asserts the new table, the new columns, the policies, the unique constraints, and the constraints without a live database.
- [ ] Given the existing availability derivation, nothing about day status changes — the new columns are plain scalars outside the calendar seam.

## Comments
