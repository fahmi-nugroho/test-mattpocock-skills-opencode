## Summary

MUA website v1: public landing + availability calendar + admin dashboard (bookings, blocks, portfolio, prices, settings).

```text
src/
├── app/                  # / (landing) + /admin + /admin/login
├── components/
│   ├── public/           # hero, portfolio-grid, price-list, availability-calendar, wa-cta
│   └── admin/            # overview, portfolio-manager, services-manager,
│                         # bookings-manager, blocks-manager, admin-calendar, settings-form
└── lib/
    ├── availability.ts   # computeDayStatus(date, bookings, blocks, fullDates, open, close)
    ├── whatsapp.ts       # buildWaLink(number, template)
    ├── calendar.ts       # doesOverlap + date keys
    └── supabase/         # public reads (RLS-safe) + admin CRUD + storage
supabase/migrations/0001-0006  # schema + RLS + storage + seed/RPC + category cap
```

```text
Admin save
  validate-booking / validate-block
    doesOverlap(candidate, bookings, blocks)
      reject double-book → message
  persist via admin-bookings / admin-blocks / admin-full-dates
    emit SCHEDULE_CHANGED → admin-calendar + overview refresh
Public month view
  month RPC (date+status only, no PII) → mapMonthAvailabilityRows → AvailabilityCalendar
```

## Evidence

- **Before:** `main` at `1bf533f` — docs/tracker shell only, no app code.
  **After:** `integration/mua-website` at `338624e` — Next.js 14 + Supabase + Tailwind app, 7/7 tickets resolved.
- Tests: 28 files, **182/182 Vitest pass** (`npm test`)
- Types: `tsc --noEmit` clean
- Build: `next build` green — `/` 8.48 kB / 161 kB, `/admin` 12.1 kB / 165 kB, `/admin/login` 1.13 kB / 154 kB

## Merge Danger

**Door:** two-way

Reversible via `git revert` of the merge; no destructive migration (0001–0006 additive, seed row id=1, RLS/storage only widen reads as specced).

**Blast Radius:** greenfield-launch

First code drop onto empty `main`. Risk is launch config, not regression: Supabase env vars, migrations 0001–0006 applied in order, storage buckets `portfolio/` + `prices/`, single admin account created manually, `revalidate = 0` landing reads live on next load.

## Code review (close-out, main...HEAD)

### Standards

(a) Documented standards — no hard violations. `AGENTS.md` only points to tracker/triage/domain docs; no `CODING_STANDARDS.md`/`CONTRIBUTING.md`. Breach count: 0. All below are judgement calls; tooling-enforced items skipped.

(b) Baseline smells (judgement calls): Duplicated Code — `loose as unknown as {from…}` Supabase cast per admin file (extract typed helper); date/time regex (`DATE_RE`/`HHMM_RE`/`MONTH_RE`) in validate-booking/validate-block/admin-full-dates/calendar/month-availability (extract shared date-keys); `getFullDatesForGuard` duplicates `readFullDates`; sort comparator duplicated in blocks/bookings managers (extract `sortByDateStart`); `ConflictBooking` vs `BookingCandidate` vs `DateRow` same shape (unify). Data Clumps + Primitive Obsession — `computeDayStatus(date, bookingsForDay, blocksForDay, fullDates, open, close)`, `findBookingConflict(candidate, bookings, blocks, fullDates)`; YYYY-MM-DD/HH:MM/wa_number as raw strings (bundle `DaySchedule`/`OperatingWindow`/`PhoneNumber`). Shotgun Surgery — `SCHEDULE_CHANGED_EVENT` fan-out across admin-calendar/blocks/bookings/page (consider one `useSchedule` hook). Mysterious Name — `QueryChain`/`tableQuery`/`q`; `queryOrderedPublicList` vs `listOrderedBySort` same shape.

### Spec

(a) Missing/partial: partial-occupancy dot never renders (spec "dot if partial occupancy") — public wiring passes no `partialDates`, RPC hides counts by design (0004 date+status only, PII); past dates keep status hue muted (`opacity-60 saturate-50` + legend) instead of full grey. (b) Scope creep: booking hard-delete added (spec asks create + confirm/cancel/reschedule only); re-pending/arbitrary transitions allowed (spec "pending → confirmed / cancelled is enforced"). (c) Implemented but divergent: manual full-toggle (`full_dates`) maps to `blocked` in both `computeDayStatus` and RPC, never `fully_booked` (spec line distinguishes the two); `computeDayStatus` counts all `bookingsForDay` regardless of status while RPC/guard use confirmed-only (admin-calendar pre-filters, so current callers are safe — any new caller must pre-filter or the seam should filter).

## Follow-ups (non-blocking)

- Extract shared date-keys + typed Supabase helper; unify booking row types.
- Decide `full_dates` semantic: `blocked` vs `fully_booked` (spec line 39 vs story 14) — currently `blocked` everywhere, consistent with 04's documented deviation.
- Decide delete-booking + re-pending policy (keep vs remove vs guard).
- Consider `computeDayStatus` filtering non-confirmed internally so the seam is status-safe.
