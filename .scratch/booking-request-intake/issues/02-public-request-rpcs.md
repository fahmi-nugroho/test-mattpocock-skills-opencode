# 02: Public read and submit functions for a request token

**Spec:** [booking-request-intake/spec.md](../spec.md)

**What to build:** The two security-definer functions that are the only way the public touches a Booking Request, plus their client-side wrappers and the fail-closed payload validator and row mapper.

**Blocked by:** 01 (needs the table and its constraints).

**Status:** resolved

- [x] Given a valid, unexpired, unsubmitted token, the read function returns only the context the admin supplied — optionally the client name and the requested date, start, and end — and no price and no other client's data.
- [x] Given a token that is already submitted or already expired, the read function refuses to return form context, so the page can show the right state instead.
- [x] Given a valid token and a well-formed payload, the submit function writes only client-owned columns and sets the submitted timestamp.
- [x] Given a missing, unknown, expired, or already-submitted token, the submit function writes nothing and reports the reason.
- [x] Given a payload with an empty name, a phone shorter than nine digits, a headcount below one, an unparseable date or time, or a start that is not before the end, the submit function rejects it, and the client-side validator rejects it with the same rules before the call is made.
- [x] Given a payload carrying extra or oversized keys, the client-side validator fails closed and strips what it does not recognise.
- [x] Given the anonymous role, both functions are executable and no other table access is granted.
- [x] Given an injected mock client, the wrappers call the right function with the right arguments and surface errors instead of swallowing them.

## Comments

- 2026-10-18 — Resolved on `feat/booking-request-intake-spec`.
  - Feature commit `8ddae50`; merged to integration as `82ce862`.
  - Added `supabase/migrations/0016_booking_request_rpcs.sql` (`get_booking_request`, `submit_booking_request`), the client wrappers/validator/row-mapper in `src/lib/booking-request.ts`, and their tests.
  - Code-review fix (commit `a8a3795`, merged `1a96f63`): the requested slot is now **per-field optional** in `submit_booking_request` (each of date/start/end may be present alone; `start < end` only when both times are present), matching the nullable columns from ticket 01 and the admin behaviour. Validation is shared with the admin path via `src/lib/admin/validate-booking-request.ts`.
  - Verified on the integration tip: 54 test files / 433 tests pass; `tsc --noEmit` clean.
