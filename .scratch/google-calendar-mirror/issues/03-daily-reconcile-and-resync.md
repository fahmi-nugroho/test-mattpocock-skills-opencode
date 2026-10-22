# 03: Daily reconcile and manual Resync

**What to build:** Once a day, and whenever the admin presses "Resync semua", the mirror repairs itself: confirmed Bookings from today forward that have no Google event get one, changed Bookings get their event corrected, events whose Booking is gone or no longer confirmed are deleted, orphaned tracked rows are removed, and leftover queue work is drained. Hand-edited or hand-deleted mirrored events are corrected back to the Booking; hand-created Google events are never touched. Past events are left as history.

**Blocked by:** 02 (can start immediately after).

**Status:** ready-for-agent

- [ ] A cron-authenticated route runs the same drain and reconcile routine used by the manual action, rejects an absent or wrong shared secret, and is safe to run at any time and twice in a row.
- [ ] Vercel cron is configured for one daily run near midnight WIB, with the route documented as the only scheduled entry point.
- [ ] Reconcile covers today-forward only and leaves past mirrored events and past tracked rows untouched.
- [ ] Confirmed Bookings with no tracked event are created; partial or failed prior work cannot leave a Booking without an event after a successful reconcile.
- [ ] Confirmed Bookings with a tracked event are updated from current Booking data, so a hand-edited title, time, description or location is overwritten.
- [ ] Google events whose Booking was hard-deleted or is no longer confirmed are deleted; the tracked row and any orphaned queue row are removed afterwards.
- [ ] Events created by hand in Google are never listed for deletion or update, because ownership is defined only by tracked event ids.
- [ ] Leftover queue work is drained, with the same retry-and-record-error behaviour as the write path; one failure does not stop the rest of the reconcile.
- [ ] A failed reconcile records the error on the connection for the banner and returns a summary (created, updated, deleted, skipped, failed) without exposing credentials or client data in logs.
- [ ] The admin settings section gains "Resync semua" with a confirmation, a progress state, and an Indonesian result summary; the Booking states refresh afterwards.
- [ ] Adapter tests with a fake port and mocked client cover missing-event-create, changed-booking-update, orphan-delete, non-confirmed-delete, past-skip, untracked-Google-event-untouched, partial-failure-continues, idempotent-second-run, and rejected cron secret.
- [ ] A reconcile that runs while the mirror is disabled does nothing and writes no Google event.
- [ ] Typecheck, the full test suite, and a production build stay green.

## Comments
