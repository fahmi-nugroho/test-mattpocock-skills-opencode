# 04: Public availability calendar

**What to build:** Read-only month calendar showing available / fully_booked / blocked per day from the derived day-status, so clients see roughly when to ask about without picking dates on-site.

**Blocked by:** 01 (status logic), 02 (month RPC data).

**Status:** resolved

- [x] Month view with 3-color days + dot for partial occupancy, past dates greyed
- [x] Uses `computeDayStatus` + month RPC (no client PII exposed)
- [x] ID month names, responsive grid, general WA CTA below calendar
- [x] Empty/loading states handled

## Comments

Resolved on `integration/mua-website`. 64/64 Vitest pass, tsc clean, `next build` green. Code-review findings fixed (deduped date-key builder, merged status switch into meta map, past days keep status hue muted instead of erased).

Deliberate deviations kept after review: (1) partial-occupancy dot is capability-only — `AvailabilityCalendar` accepts `partialDates` but public wiring passes none, because the month RPC intentionally hides occupancy counts (0004 contract: date+status only, shape must stay unchanged) and deriving occupancy client-side would need raw bookings = PII leak; (2) `computeDayStatus` runs in SQL (RPC mirrors it), not client-side, for the same PII reason — client validates rows via `mapMonthAvailabilityRows`; (3) month prev/next nav, error+retry, and legend added as necessary support for "month view" / "states handled"; (4) empty branch kept defensive though the RPC contract (one row per date) makes it unreachable — missing dates fail closed to neutral "Belum ada info".
