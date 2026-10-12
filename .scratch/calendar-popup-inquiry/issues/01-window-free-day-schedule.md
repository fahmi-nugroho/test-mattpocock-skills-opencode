# 01: Window-free day schedule data

**What to build:** The public day schedule returns raw unclamped occupied ranges so bookings at any hour of the day are visible, with the operating-window coverage derivation removed and the privacy contract intact.

**Blocked by:** None (can start immediately).

**Status:** resolved

## Comments

- Implemented on `integration/calendar-popup-inquiry` via merge `f7b41f4` (feat commit `163eee8`).
- `0010_day_schedule_window_free.sql`: raw unclamped occupied, no hours read, no coverage derivation (`fully_booked` unreachable), all-day closure outranks, `free` always `[]`, privacy + grants preserved.
- `day-schedule.ts` doc comments updated (validator behavior unchanged: strips extra keys, fails closed).
- Tests: raw any-hour multi-range + service/hours-leak cases added; `schema.test.ts` 0010 shape case added. `npm test` 35 files / 233 passed, `npm run typecheck` clean.
- Code review (db5d3aa...HEAD): Standards — no hard violations (one excused SQL-internals candidate follows file prior art); Spec — all ticket criteria met, no scope creep, one non-blocking note (SQL `c.s < c.e` drops malformed DB rows before client validator).

- [ ] Given a date with confirmed bookings or timed blocks at any hour, the public day result lists every occupied range with start, end, and kind only, sorted chronologically, with no clamping and no dropped ranges.
- [ ] Given extra keys carrying personal data or hours in the raw payload, the validator strips them and fails closed on malformed shapes.
- [ ] Pending and cancelled bookings never occupy and never appear; all-day closure still outranks times.
- [ ] Mocked-payload unit tests cover raw multi-range days, empty days, all-day closure, malformed rows, and leak-attempt payloads.
