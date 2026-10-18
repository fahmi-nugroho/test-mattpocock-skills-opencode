# 01: Schema foundation for requests and the new booking fields

**Spec:** [booking-request-intake/spec.md](../spec.md)

**What to build:** A forward migration creating the `booking_requests` table and adding the six new columns to `bookings`, with the matching policies and a token that cannot be guessed. Extend the existing declarative migration contract test to cover it.

**Blocked by:** nothing.

**Status:** resolved

- [x] Given the migration is applied, `bookings` has `event_type`, `headcount`, `venue`, `hairdo` (non-null with sensible defaults), `total_price` (nullable) and `dp_amount` (non-null default `0`), each constrained as specified.
- [x] Given the migration is applied, `booking_requests` exists with the token, the three bookkeeping timestamps, the client fields, the requested slot, and `accepted_booking_id` referencing bookings and unique.
- [x] Given two requests are created without a supplied token, each receives a different database-generated 128-bit value, and the row id never leaks as the token.
- [x] Given the anonymous role, it cannot select, insert, update, or delete `booking_requests` directly; given the authenticated role, it can do all four as with the existing tables.
- [x] Given the migration files on disk, the declarative SQL verify test asserts the new table, the new columns, the policies, the unique constraints, and the constraints without a live database.
- [x] Given the existing availability derivation, nothing about day status changes — the new columns are plain scalars outside the calendar seam.

## Comments

- 2026-10-18 — Resolved on `feat/booking-request-intake-spec`.
  - Feature commit `9463502`; merged to integration as `91283c3`.
  - Added `supabase/migrations/0015_booking_requests_schema.sql`: the `booking_requests` table (database-generated 128-bit token, the three bookkeeping timestamps, the client fields, the requested slot, and a unique `accepted_booking_id` referencing `bookings`) plus the six new `bookings` columns with their constraints, and RLS so `anon` has no access while `authenticated` has full access.
  - Extended the declarative migration-contract test in `src/lib/__tests__/schema.test.ts`.
  - Review-fix pass left this ticket unchanged: the slot columns were already nullable and `start < end` already applied only when both times were present, which is exactly what the per-field submit path needs.
