# 02: Popup dialog replacing inline panel

**What to build:** Tapping a calendar date opens a modal popup showing that day's booked and blocked times, replacing the inline detail panel below the calendar entirely.

**Blocked by:** 01 (needs the window-free day shape).

**Status:** resolved

- [x] Given a tap on a today or future date, a modal popup opens with loading, error-with-retry, times list, closed-all-day, and available-all-day states; the popup header shows the full date plus the day status label.
- [x] Given the popup open, close button, backdrop tap, and Escape all dismiss it, background scrolling locks while open, and focus returns to the invoking date on close.
- [x] Given a tap on a past date, nothing opens and the day stays inert and muted.
- [x] Given the popup open, the date chat action is present and the general chat starter is hidden; given no popup, only the general chat starter shows.
- [x] Given a month change while open, the popup closes and no stale day detail lingers; the inline panel no longer exists anywhere.

## Comments

- Implemented on `integration/calendar-popup-inquiry` via merge `770e466` (feat commit `da91034`).
- `availability-calendar.tsx`: today/future taps open a `role="dialog"` `aria-modal` popup (backdrop + panel, `aria-live` content, header with full Indonesian date plus status label from detail or month map); close button (autofocused), backdrop tap, and Escape all dismiss; body scroll locks while open; focus returns to the invoking `data-date` button on close; past days stay inert muted divs; date chat CTA lives inside loaded popup content while the general starter renders only when no popup is open (no CTA during loading/error); month change and same-date re-tap clear detail state so nothing stale lingers; inline panel deleted.
- No new pure unit tests: popup reuses ticket-01-tested `mapDayScheduleRow`/`mergeOccupied`; vitest seam covers only `*.test.ts` (no component harness). `npm test` 35 files / 233 passed, `npm run typecheck` clean.
