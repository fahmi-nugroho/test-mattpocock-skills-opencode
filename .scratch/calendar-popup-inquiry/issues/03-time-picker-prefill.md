# 03: Time picker with datetime chat prefill

**What to build:** The popup lets the client propose a start and end time to ask about, validated live against the shown occupied ranges, and prefills the chosen time into the chat message.

**Blocked by:** 02 (needs the popup shell).

**Status:** resolved

- [x] Given the popup on a bookable day, empty start and end inputs with a choose-a-time hint are shown; given a full or closed-all-day popup, no picker and no date chat action appear.
- [x] Given an end time not after the start time, an order error shows and the date chat action stays disabled.
- [x] Given a chosen range overlapping any booked or blocked range under half-open semantics (touching edges allowed), an overlap error shows and the date chat action stays disabled.
- [x] Given a valid non-overlapping range, the date chat action enables and its message carries the date plus the chosen start-end range; a secondary time-less date chat action remains available.
- [x] Pure unit tests cover overlap verdicts (overlap, touching, contained, inverted) and the date-plus-time message building with encoding.

## Comments

- Implemented on `integration/calendar-popup-inquiry` via merge `a96dd87` (feat commit `569048b`).
- `time-picker.ts` (new): pure `validatePickerRange(start, end, occupied)` → hint/order/overlap/valid, delegating to shared `doesOverlap` half-open rule; `whatsapp.ts` gains `buildDateTimeWaMessage`/`buildDateTimeWaLink` (`"<date msg> jam <start>-<end>"`) reusing `buildWaLink`; existing date-only builders untouched.
- `availability-calendar.tsx`: bookable days get empty start+end time inputs with hint, `role="alert"` order/overlap errors, disabled-until-valid datetime action plus secondary time-less date action; full/closed-all-day popups render no picker and no date actions; picker state resets on close/tap/month-change.
- Tests: `time-picker.test.ts` (10 tests: hint, order, overlap booked/blocked, contained both ways, touching-allowed, multi-range) + `wa-messages.test.ts` (+4: message shape, encoding, digit normalisation). `npm test` 36 files / 247 passed, `npm run typecheck` clean.
- Code review (`a567ffe...HEAD`): Standards — no hard violations (4 judgement-call smells, no action); Spec — all 5 ticket bullets met, no scope creep, no wrong implementations.
