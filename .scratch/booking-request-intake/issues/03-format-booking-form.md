# 03: The Format Booking form page

**Spec:** [booking-request-intake/spec.md](../spec.md)

**What to build:** The token-keyed page the client opens: a short Indonesian form over the public read/write wrappers, with the prefilled slot, the clash warning, and every terminal state.

**Blocked by:** 02 (needs the read and submit functions).

**Status:** needs-triage

- [ ] Given a valid token with a slot set by the admin, the form opens with the date and times prefilled and editable; given a token with no slot, the date and times start empty for the client to propose.
- [ ] Given the client picks a range that overlaps an existing booked or blocked range, a warning appears using the same half-open overlap rule and the same public day data as the calendar popup, and it never prevents submission.
- [ ] Given the client submits a valid form, they see a clear confirmation, and reopening the same link shows the already-sent state instead of a blank form.
- [ ] Given an expired link, the page shows an Indonesian "link expired, ask for a new one" state and offers no submit action.
- [ ] Given a malformed or oversize input, the client sees an inline Indonesian error naming the field, and nothing is submitted.
- [ ] Given the page is open, a sentence states that the slot is not locked until the down payment arrives, and no price appears anywhere on the page.
- [ ] Given a loading, error, or already-submitted state, the page announces it politely to assistive technology and offers a retry where a retry makes sense.
- [ ] Given a small phone screen, the form is usable without horizontal scrolling and every label and error is Indonesian.

## Comments
