# 04: Hours-removal contract with month and admin cleanup

**What to build:** Operating hours are removed from the product end to end once every reader has migrated, with month status, admin settings, seeds, and tests consistent and the decision recorded.

**Blocked by:** 01, 02 (every hours reader migrated; 03 runs parallel since it never touches hours).

**Status:** resolved

- [x] Given the migrated public callers, the settings hours columns are dropped via a forward migration carrying a restore note, and the day-status derivation no longer takes a window.
- [x] Given any date, the public month result resolves to closed for full-toggle or all-day blocks and available otherwise; the full status is unreachable but its legend and metadata remain as dead code.
- [x] Given the admin settings form, no operating-hours inputs are shown and hours validation, seeds, and fixtures carry no hours.
- [x] Given the full suite plus typecheck, everything is green; an ADR records why the window and coverage derivation were removed and what would revive the full status.

## Comments

- Implemented on `integration/calendar-popup-inquiry` via merge `b9fb406` (feat commit `45dc2b2`), review nits via merge `f3352b8` (fix commit `292e17d`).
- `0011_month_window_free.sql`: month RPC redefined first to read ONLY `full_dates` (blocked for full-toggle/all-day, else available); no `open_hour`/`close_hour`/`hhmm_to_min`/`generate_series`/`greatest`/`least` tokens; return shape `(date, status)` + anon grant unchanged. `0012_settings_drop_hours.sql`: drops both columns with header restore note; `wa_number`/`full_dates` untouched.
- `computeDayStatus(date, bookings, blocks, fullDates)` — window args + `coversWindow` removed; `fully_booked` kept as documented dead code. `AdminCalendar` prop-less; admin page WA-only form; `validateSettingsInput`/`updateSettings`/`Settings` WA-only; README updated to WA-only.
- Tests: `availability`, `validate-settings`, `admin-settings` rewritten window-free; `schema.test.ts` gains 0011/0012 blocks; 0001 historic assertions and `day-schedule` adversarial hours strip-fixtures kept with clarifying comments. `npm test` 36 files / 249 passed, `npm run typecheck` clean.
- ADR `docs/adr/0001-hours-removal.md`: why removed (out-of-window bookings hidden, setting unused) + 4-step revival path.
- Code review (`72a6f1e...HEAD`): Standards — no hard violations (3 benign judgement calls, one fixed: wrong migration number in comment); Spec — no scope creep, partials fixed (README hours refs, adversarial-fixture comments); silent-ignore of stray hours keys kept deliberately (strip matches validator philosophy).
