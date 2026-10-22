# 02: Mirror confirmed Bookings into Google

**What to build:** Confirming a Booking creates exactly one event in the connected calendar; editing the Booking updates that event; cancelling, reverting to pending, or deleting the Booking removes it. The event carries the client and service in the title, the venue as location, and every Booking field in the description, timed in Asia/Jakarta, marked Busy, with no attendees. Confirmed Bookings from today forward are backfilled on the first successful drain. Each Booking row shows whether Google has it, and a failed push never blocks the local save.

**Blocked by:** 01 (can start immediately after).

**Status:** ready-for-agent

- [ ] A migration declares the tracked-event table (one row per Booking, Google event id, last synced timestamp) and the work queue (Booking reference, attempt count, next attempt, last error, processed timestamp), both admin-only with no anonymous policy.
- [ ] Tracked-event and queue rows deliberately do not cascade when the Booking is hard-deleted, so a delete can still remove the Google event and reconcile can clean up the orphaned row afterwards.
- [ ] A pure projection turns a Booking plus its service name into the Google event body: title "Client — Service" with event-type then "Booking" fallbacks, venue as location, plain Indonesian-labelled description lines for every non-empty Booking field plus the Booking id, IDR amounts, RFC 3339 start/end at `+07:00`, Busy, calendar-default reminders, no attendees.
- [ ] Description fields cover client name, phone, service, event type, Headcount, venue, Style, Reference, notes, agreed total and DP, and never include Invoice numbers, bank details or other Invoice data.
- [ ] A pure planner turns confirmed Bookings plus tracked events into create/update/delete work, applies the today-forward WIB cut-off, and treats past or already-tracked Bookings as no-ops for backfill.
- [ ] The Google port is injected: the adapter creates, updates, deletes and lists owned events, and stores the Google event id immediately on create so a later edit updates rather than duplicates.
- [ ] Any successful admin write leaving a Booking confirmed enqueues an upsert; leaving it pending or cancelled, or hard-deleting it, enqueues a delete. Repeated saves for one Booking coalesce into one pending intent.
- [ ] A Node-runtime route verifies the admin's Supabase access token, drains the queue, and returns the per-Booking results. The browser never holds a Google credential and still writes Bookings exactly as before.
- [ ] The first successful drain after the connection is enabled backfills confirmed Bookings dated today or later in Asia/Jakarta, skipping past and already-tracked Bookings; running it twice creates no duplicates.
- [ ] Draining takes a per-Booking lock and re-reads the tracked row before creating, so at most one event exists per Booking even if two saves race.
- [ ] A Google failure leaves the queue row open with its error and never throws into the Booking save; the next drain and the daily cron retry it, and the failure is visible on the Booking.
- [ ] The Booking manager shows Tersinkron, Menunggu, or Gagal per Booking and offers a retry; the states are derived from the tracked row and the open queue row, never hand-set.
- [ ] A hard-deleted Booking's event is removed even though the Booking row is already gone, because its tracked row survives until the Google delete succeeds.
- [ ] Unit tests at the projection and planner seam cover missing service, blank optional fields, a long Reference, past and cancelled Bookings, and orphaned tracked events.
- [ ] Adapter tests with a fake Google port and the existing loose client mock cover create-stores-id, update-reuses-id, exit-from-confirmed-deletes, failure-leaves-Failed-without-throw, retry-succeeds, backfill-skips-past-and-tracked, and no-duplicate-on-repeat.
- [ ] Declarative SQL tests assert both new tables, the one-event-per-Booking invariant, admin-only RLS, and the deliberate non-cascade behaviour.
- [ ] Typecheck and the full existing test suite stay green; the public calendar, Block handling, Invoice lifecycle, and Booking Request intake are unchanged.

## Comments
