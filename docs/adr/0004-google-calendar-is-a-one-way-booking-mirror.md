# ADR-0004: Google Calendar is a one-way mirror of confirmed Bookings

Status: accepted

Date: 2026-10-22

## Context

The owner plans her days in Google Calendar while Bookings live in the dashboard.
Keeping both in step by hand means retyping confirmed work into Google and then
manually moving or deleting it when a client reschedules or cancels, or trusting
a Google calendar that shows free time she has already sold. Either way the two
views drift, and the drift is invisible until a double booking happens.

The obvious repair is to connect the calendar. That forces three choices: whether
Google may change the app, which records become events, and how the app proves
it is allowed to write. Each has a tempting but unsafe default — two-way sync,
mirroring everything that occupies the public calendar, and OAuth as the owner's
Google account.

## Decision

Google Calendar is a one-way **Calendar Mirror** of confirmed Bookings only.

- The app creates, updates and deletes events; Google never writes back. A
  personal event added in Google does not block public availability, and editing
  or deleting a mirrored event in Google is corrected by the daily reconcile,
  not obeyed.
- Only confirmed Bookings are projected. Blocks, full dates, pending and
  cancelled Bookings, Booking Requests and Invoices stay out, so Google names a
  client-work list rather than the availability calendar.
- Events live in the owner's dedicated secondary calendar rather than her primary
  one, and the app authenticates as a service account that calendar has been
  shared with ("Make changes to events"). The credential stays server-side and no
  OAuth consent screen, refresh token, or testing-mode expiry is involved.
- Backfill is today forward; history is left alone. Disconnecting stops the
  mirror and leaves existing events in place.

Alternatives considered:

1. **Two-way sync.** It sounds more convenient, but it makes every Google entry a
   potential booking and every Google deletion a cancellation. It needs conflict
   rules, an import of events the app did not create, and trust in arbitrary
   Google data for public availability — a large feature with PII and
   double-booking risk. Rejected for v1.
2. **Mirror the whole occupancy model (Bookings plus Blocks and full dates).**
   Rejected by the owner: Google should show client work, not her private time.
   The cost is explicit: Google can look empty on a day the public calendar is
   closed.
3. **An ICS subscription feed instead of the API.** Cheap and read-only, but
   Google polls it on its own schedule, so edits and deletes lag by hours, and the
   app cannot verify that its write reached Google. Rejected because the owner
   asked for edits and deletes to take effect.
4. **OAuth as the owner's Google account.** Natural for a multi-user product, but
   this is one artist and one calendar. An app left in testing status expires
   refresh tokens weekly, and publishing a sensitive-scope app means
   verification. A service account avoids both and narrows access to the shared
   calendar.

## Consequences

- Google is always a projection and can lag: during an outage the dashboard and
  public calendar stay correct while Google is stale until the queue drains or
  the daily reconcile runs. That ordering is deliberate — a Booking save must
  never fail because Google did.
- Drift caused by hand edits is corrected, not preserved. The owner must delete
  or change a Booking in the app; deleting the event in Google is not a cancel.
- Google is not a full timetable. Blocked days and personal events will not appear
  in the mirror, and the owner should not plan availability from Google alone.
- The service-account setup is human console work (project, Calendar API, service
  account key, calendar share). The app can test the share but cannot create it,
  so onboarding carries a documented checklist.
- The integration is intentionally hard to walk back into two-way later: adding
  Google as a source of availability would change what "confirmed Booking" means
  and would need conflict rules this decision avoids. That is the reason for
  recording it.
