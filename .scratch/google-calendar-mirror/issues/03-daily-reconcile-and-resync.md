# 03: Daily reconcile and manual Resync

**What to build:** Once a day, and whenever the admin presses "Resync semua", the mirror repairs itself: confirmed Bookings from today forward that have no Google event get one, changed Bookings get their event corrected, events whose Booking is gone or no longer confirmed are deleted, orphaned tracked rows are removed, and leftover queue work is drained. Hand-edited or hand-deleted mirrored events are corrected back to the Booking; hand-created Google events are never touched. Past events are left as history.

**Blocked by:** 02 (can start immediately after).

**Status:** resolved

- [x] A cron-authenticated route runs the same drain and reconcile routine used by the manual action, rejects an absent or wrong shared secret, and is safe to run at any time and twice in a row.
- [x] Vercel cron is configured for one daily run near midnight WIB, with the route documented as the only scheduled entry point.
- [x] Reconcile covers today-forward only and leaves past mirrored events and past tracked rows untouched.
- [x] Confirmed Bookings with no tracked event are created; partial or failed prior work cannot leave a Booking without an event after a successful reconcile.
- [x] Confirmed Bookings with a tracked event are updated from current Booking data, so a hand-edited title, time, description or location is overwritten.
- [x] Google events whose Booking was hard-deleted or is no longer confirmed are deleted; the tracked row and any orphaned queue row are removed afterwards.
- [x] Events created by hand in Google are never listed for deletion or update, because ownership is defined only by tracked event ids.
- [x] Leftover queue work is drained, with the same retry-and-record-error behaviour as the write path; one failure does not stop the rest of the reconcile.
- [x] A failed reconcile records the error on the connection for the banner and returns a summary (created, updated, deleted, skipped, failed) without exposing credentials or client data in logs.
- [x] The admin settings section gains "Resync semua" with a confirmation, a progress state, and an Indonesian result summary; the Booking states refresh afterwards.
- [x] Adapter tests with a fake port and mocked client cover missing-event-create, changed-booking-update, orphan-delete, non-confirmed-delete, past-skip, untracked-Google-event-untouched, partial-failure-continues, idempotent-second-run, and rejected cron secret.
- [x] A reconcile that runs while the mirror is disabled does nothing and writes no Google event.
- [x] Typecheck, the full test suite, and a production build stay green.

## Comments

Resolved on `feat/google-calendar-mirror-spec`. Evidence: `npm run typecheck` clean, full Vitest suite green (70 files / 683 tests), `npm run build` green.

Implementation map:

- `src/lib/google/mirror.ts` — `reconcileMirror` plans the today-forward desired state, enqueues it, and drains it through the same retry/error path as a Booking save. It recreates hand-deleted tracked events and treats an already-missing event as deleted, cleans up finished delete queue rows, and returns `{ created, updated, deleted, skipped, failed, error }`.
- `src/lib/google/mirror-projection.ts` — the existing `planMirrorWork` is the reconcile planner: create/update confirmed future Bookings, delete events for non-confirmed or orphaned Bookings, skip past Bookings and past tracked rows.
- `src/lib/google/cron-auth.ts` — shared-secret check for the scheduled route; accepts Vercel's bearer header or `x-cron-secret`, rejects absent/wrong values.
- `src/app/api/cron/google-calendar/route.ts` — the only scheduled entry point; uses the service-role server client because it has no admin session.
- `src/app/api/admin/google-calendar/route.ts` — new authenticated `resync` action calling the same `reconcileMirror`.
- `src/components/admin/google-calendar-settings.tsx` — **Resync semua** with confirmation, progress, Indonesian counts, and a schedule-changed refresh for Booking badges.
- `vercel.json` — one daily cron at `0 17 * * *` UTC (midnight WIB).
- `supabase/migrations/0022_google_calendar_cron_grants.sql` — explicit `service_role` execute grants for the two queue RPCs used by the sessionless cron.
- Docs: README and `docs/google-calendar-setup.md` document the cron as the only scheduled entry point and the server-only service-role requirement.

Tests: `google-calendar-reconcile.test.ts` covers missing-event-create, changed-booking-update, hand-deleted-event-recreate, orphan-delete, non-confirmed-delete, past-skip (including leftover past work), untracked-Google-event-untouched, partial-failure-continues, idempotent-second-run, disabled no-op, and cron-secret rejection. The Vercel cron declaration is asserted declaratively.

Review dispositions: added `onlyTodayForward` queue filtering so reconcile cannot repair a past Booking through a leftover intent; shared the route config/runtime composition; removed the extra cron `POST`; added explicit service-role grants; added a one-minute due-clock grace so a just-enqueued Resync row is never skipped on database clock skew.
