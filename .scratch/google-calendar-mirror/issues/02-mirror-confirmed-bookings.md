# 02: Mirror confirmed Bookings into Google

**What to build:** Confirming a Booking creates exactly one event in the connected calendar; editing the Booking updates that event; cancelling, reverting to pending, or deleting the Booking removes it. The event carries the client and service in the title, the venue as location, and every Booking field in the description, timed in Asia/Jakarta, marked Busy, with no attendees. Confirmed Bookings from today forward are backfilled on the first successful drain. Each Booking row shows whether Google has it, and a failed push never blocks the local save.

**Blocked by:** 01 (can start immediately after).

**Status:** resolved

- [x] A migration declares the tracked-event table (one row per Booking, Google event id, last synced timestamp) and the work queue (Booking reference, attempt count, next attempt, last error, processed timestamp), both admin-only with no anonymous policy.
- [x] Tracked-event and queue rows deliberately do not cascade when the Booking is hard-deleted, so a delete can still remove the Google event and reconcile can clean up the orphaned row afterwards.
- [x] A pure projection turns a Booking plus its service name into the Google event body: title "Client — Service" with event-type then "Booking" fallbacks, venue as location, plain Indonesian-labelled description lines for every non-empty Booking field plus the Booking id, IDR amounts, RFC 3339 start/end at `+07:00`, Busy, calendar-default reminders, no attendees.
- [x] Description fields cover client name, phone, service, event type, Headcount, venue, Style, Reference, notes, agreed total and DP, and never include Invoice numbers, bank details or other Invoice data.
- [x] A pure planner turns confirmed Bookings plus tracked events into create/update/delete work, applies the today-forward WIB cut-off, and treats past or already-tracked Bookings as no-ops for backfill.
- [x] The Google port is injected: the adapter creates, updates, deletes and lists owned events, and stores the Google event id immediately on create so a later edit updates rather than duplicates.
- [x] Any successful admin write leaving a Booking confirmed enqueues an upsert; leaving it pending or cancelled, or hard-deleting it, enqueues a delete. Repeated saves for one Booking coalesce into one pending intent.
- [x] A Node-runtime route verifies the admin's Supabase access token, drains the queue, and returns the per-Booking results. The browser never holds a Google credential and still writes Bookings exactly as before.
- [x] The first successful drain after the connection is enabled backfills confirmed Bookings dated today or later in Asia/Jakarta, skipping past and already-tracked Bookings; running it twice creates no duplicates.
- [x] Draining takes a per-Booking lock and re-reads the tracked row before creating, so at most one event exists per Booking even if two saves race.
- [x] A Google failure leaves the queue row open with its error and never throws into the Booking save; the next drain and the daily cron retry it, and the failure is visible on the Booking.
- [x] The Booking manager shows Tersinkron, Menunggu, or Gagal per Booking and offers a retry; the states are derived from the tracked row and the open queue row, never hand-set.
- [x] A hard-deleted Booking's event is removed even though the Booking row is already gone, because its tracked row survives until the Google delete succeeds.
- [x] Unit tests at the projection and planner seam cover missing service, blank optional fields, a long Reference, past and cancelled Bookings, and orphaned tracked events.
- [x] Adapter tests with a fake Google port and the existing loose client mock cover create-stores-id, update-reuses-id, exit-from-confirmed-deletes, failure-leaves-Failed-without-throw, retry-succeeds, backfill-skips-past-and-tracked, and no-duplicate-on-repeat.
- [x] Declarative SQL tests assert both new tables, the one-event-per-Booking invariant, admin-only RLS, and the deliberate non-cascade behaviour.
- [x] Typecheck and the full existing test suite stay green; the public calendar, Block handling, Invoice lifecycle, and Booking Request intake are unchanged.

## Comments

Resolved on `feat/google-calendar-mirror-spec`. Evidence: `npm run typecheck` clean, full Vitest suite green (69 files / 666 tests), `npm run build` green.

Implementation map:

- `supabase/migrations/0021_google_calendar_mirror.sql` — `google_calendar_events` (one row per Booking) and `google_calendar_work` (one coalescing intent per Booking), both admin-only RLS, deliberately no FK to `bookings`, plus `enqueue_google_calendar_work` and `claim_google_calendar_work` (10-minute stale-claim recovery).
- `src/lib/google/mirror-projection.ts` — pure `buildMirrorEvent`, `planMirrorWork`, `planBackfill` (the create half of the planner), and `mirrorTodayKey` (Asia/Jakarta).
- `src/lib/google/mirror.ts` — drain adapter: today-forward backfill, per-Booking claim, tracked-row re-read, create/update/delete, ownership-marker adoption, and open-intent preservation when a newer save lands mid-drain.
- `src/lib/supabase/admin-mirror.ts` — browser-side enqueue RPC and the snapshot the Booking manager derives badges from.
- `src/lib/google/mirror-state.ts` — strict derived Tersinkron / Menunggu / Gagal from the tracked row and open queue row only.
- `src/components/admin/bookings-manager.tsx` — badges, `Coba lagi` retry, and a best-effort drain/refresh after every successful Booking write.
- `src/app/api/admin/google-calendar/route.ts` — authenticated `drain` action and a best-effort drain right after `connect` to trigger the first backfill.

Tests: `google-calendar-mirror-projection.test.ts` (projection + planner), `google-calendar-mirror.test.ts` (fake port + loose client adapter, including adoption, mid-drain change, retry, and delete-without-tracked), `google-calendar-mirror-state.test.ts`, `google-calendar-mirror-schema.test.ts` (declarative SQL), and `admin-bookings.test.ts` (enqueue after local writes).

Review dispositions: reused the planner for backfill instead of duplicating its filters; used the claimed snapshot's operation/attempt count rather than the pre-claim row; added a post-success re-read so a save coalesced mid-drain stays open; made delete list owned events when the tracked row is missing; made the state derivation evidence-only (no badge from Booking status alone); renamed the UI helpers away from `sync`; consolidated queue helpers in `admin-mirror.ts`; documented both admin RPCs in the README.
