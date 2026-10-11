# 07: Admin bookings blocks full-toggle

**What to build:** Admin booking and block management with overlap guard, manual day-full toggle, and admin calendar, so all date/time negotiation from WA is recorded and public status stays correct.

**Blocked by:** 01 (overlap logic), 02 (bookings/blocks schema), 05 (admin guard).

**Status:** resolved

- [x] Bookings CRUD with date + start-end + service + client name/phone + notes, status pending → confirmed / cancelled, reschedule supported
- [x] Blocks CRUD with all-day OR time-range + reason; full_dates manual toggle per date
- [x] `doesOverlap` enforced on save (confirmed bookings vs blocks), double-booking rejected with message
- [x] Admin calendar + list view; confirming/cancelling updates public day-status (04)

## Comments

Resolved on `integration/mua-website` at `ddcab8b` + follow-up `205e6a4` (refresh admin overview on schedule changes). Verified at HEAD `205e6a4`: 182/182 Vitest pass, tsc clean, `next build` green.
