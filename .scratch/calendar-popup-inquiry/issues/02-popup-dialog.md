# 02: Popup dialog replacing inline panel

**What to build:** Tapping a calendar date opens a modal popup showing that day's booked and blocked times, replacing the inline detail panel below the calendar entirely.

**Blocked by:** 01 (needs the window-free day shape).

**Status:** ready-for-agent

- [ ] Given a tap on a today or future date, a modal popup opens with loading, error-with-retry, times list, closed-all-day, and available-all-day states; the popup header shows the full date plus the day status label.
- [ ] Given the popup open, close button, backdrop tap, and Escape all dismiss it, background scrolling locks while open, and focus returns to the invoking date on close.
- [ ] Given a tap on a past date, nothing opens and the day stays inert and muted.
- [ ] Given the popup open, the date chat action is present and the general chat starter is hidden; given no popup, only the general chat starter shows.
- [ ] Given a month change while open, the popup closes and no stale day detail lingers; the inline panel no longer exists anywhere.
