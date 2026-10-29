# Spec: Google Calendar Mirror

Status: ready-for-agent

## Problem Statement

As the owner, I confirm bookings in the dashboard, but my Google Calendar never hears about them. I plan my days from Google, so I either retype the booking there and keep two calendars in step by hand, or I trust a calendar that says I am free while a client is booked. When a client reschedules or cancels, the Google entry I made by hand stays behind, so the two views drift further apart. I want confirmed client work to appear in Google automatically, and to move or disappear when I change the Booking — without Google ever becoming a second place where bookings can be created or changed.

## Solution

A dedicated secondary Google Calendar ("MUA — Booking") in my own account becomes a one-way **Calendar Mirror** of confirmed Bookings. Confirming a Booking creates an event; editing the Booking updates it; cancelling, reverting to pending, or deleting the Booking removes it. The event title names the client and service, the venue becomes the location, and the description carries every Booking field, priced in IDR. Events are timed in `Asia/Jakarta`, shown as Busy, and invite nobody.

Connecting updates the calendar from today forward; past Bookings are left alone. The admin dashboard shows whether the connection is healthy and each Booking's mirror state (Tersinkron / Menunggu / Gagal), with a retry. If Google is unreachable, the Booking still saves exactly as it does today — the change waits and retries, and a daily reconcile repairs any event that was edited or deleted by hand in Google. Disconnecting stops the mirror and leaves existing events in place.

Google stays a projection: Blocks, full dates, pending Bookings, Booking Requests and Invoices never appear there, personal Google events never affect the public calendar, and changing a mirrored event in Google changes nothing in the app.

## User Stories

1. As the owner, I want confirmed Bookings to appear in a dedicated Google Calendar automatically, so that my phone calendar shows client work without retyping.
2. As the owner, I want the mirror to live in its own secondary calendar, so that my personal events and the business projection never mix.
3. As the owner, I want to share only that one calendar with the app's robot identity, so that nothing else in my Google account is reachable.
4. As the owner, I want a plain setup checklist for the Google Cloud steps, so that I can finish the one-time console work without guessing.
5. As the owner, I want to see whether the connection is configured, enabled, and healthy, so that I know the mirror is actually running.
6. As the owner, I want a "test connection" action that verifies read and write access, so that a wrong sharing permission is caught before a booking silently fails.
7. As the owner, I want an Indonesian explanation when credentials are missing or rejected, so that I can fix the environment rather than decode an API error.
8. As the owner, I want to disconnect the mirror and have it stop writing, so that I can pause it without touching Google.
9. As the owner, I want disconnecting to leave already-mirrored events in Google, so that a pause never wipes a month of my calendar.
10. As the owner, I want a Booking that becomes confirmed to create exactly one event, so that repeated saves never duplicate work.
11. As the owner, I want moving a Booking's date or time to move its Google event, so that the two views agree on when I am busy.
12. As the owner, I want editing client, service, venue, headcount, Style, Reference, notes, total or DP to update the existing event, so that Google always shows the current Booking.
13. As the owner, I want cancelling a confirmed Booking to remove its event, so that a cancelled client does not hold time on my calendar.
14. As the owner, I want reverting a Booking to pending to remove its event, so that only confirmed work occupies the mirror.
15. As the owner, I want deleting a Booking to remove its event, so that hard deletions do not leave orphans.
16. As the owner, I want pending and cancelled Bookings to never create an event, so that the mirror means confirmed work only.
17. As the owner, I want the first connection to mirror confirmed Bookings from today forward, so that my coming weeks are useful immediately.
18. As the owner, I want past Bookings left out of the backfill, so that the calendar is not flooded with history.
19. As the owner, I want the event title to read "Client — Service", so that I can identify a job at a glance.
20. As the owner, I want the title to fall back to the event type or "Booking" when no service is linked, so that a title is never blank.
21. As the owner, I want the venue in the event location, so that navigation on my phone works.
22. As the owner, I want the description to list every Booking field — client, phone, service, event type, Headcount, venue, Style, Reference, notes, total and DP — so that I can answer a client without opening the dashboard.
23. As the owner, I want blank optional fields omitted from the description, so that it stays readable rather than full of empty labels.
24. As the owner, I want prices shown as IDR, so that the description matches how I quote.
25. As the owner, I want no Invoice number, bank details, or other Invoice data in the description, so that the mirror does not become a second invoice record.
26. As the owner, I want every event timed in `Asia/Jakarta`, so that nothing shifts when the server or my phone is in another zone.
27. As the owner, I want mirrored events marked Busy, so that Google treats that time as taken when I schedule anything else.
28. As the owner, I want no attendees and no client invite emails, so that clients are not pulled into a new channel.
29. As the owner, I want a per-Booking state of Tersinkron, Menunggu, or Gagal, so that I can see which bookings Google actually knows about.
30. As the owner, I want a retry on a failed Booking, so that a transient Google error is one tap away from fixed.
31. As the owner, I want a dashboard banner when the connection is broken, so that I do not trust a stale calendar.
32. As the owner, I want a Booking save to succeed even when Google is down, so that operations never depend on a third party.
33. As the owner, I want failed mirror work queued and retried, so that an outage heals itself without me re-saving every Booking.
34. As the owner, I want a daily reconcile that recreates missing events, corrects changed ones, and removes events for Bookings that are no longer confirmed, so that hand edits in Google do not persist.
35. As the owner, I want a manual "Resync semua" action, so that I can repair the mirror on demand after changing something in Google.
36. As the owner, I want hand-created Google events left untouched, so that the mirror never deletes something it did not create.
37. As the owner, I want deleting or editing a mirrored event in Google to be corrected, not obeyed, so that the dashboard stays the source of truth.
38. As the owner, I want Blocks, full dates, Booking Requests and Invoices to stay out of Google, so that the mirror is unambiguous about what it represents.
39. As the owner, I want my personal Google events to never change public availability, so that the client-facing calendar keeps its existing meaning.
40. As the owner, I want credentials to stay server-side only, so that no browser can reach my calendar.
41. As the owner, I want the public calendar and every existing Booking, Block, Invoice and Booking Request behaviour unchanged, so that this feature cannot break what already works.

## Implementation Decisions

- **Concept.** The feature is a **Calendar Mirror**: a one-way projection of confirmed Bookings. It is not the availability calendar and not a sync. The glossary gains the term; the ADR records that Google is never a source of truth.
- **Scope.** Only Bookings whose status is `confirmed` are projected. Blocks, `settings.full_dates`, pending/cancelled Bookings, Booking Requests and Invoices are excluded by design. The public RPCs and the public calendar are untouched.
- **Lifecycle.** Any successful admin write that leaves a Booking confirmed enqueues an upsert; any write that leaves it pending/cancelled, or a hard delete, enqueues a delete. Upserts are idempotent per Booking: at most one mirrored event exists for a Booking, enforced by a per-Booking lock and a re-read of the tracked row before creating.
- **Backfill.** On the first successful drain after the connection is enabled, enqueue every confirmed Booking dated today or later in `Asia/Jakarta` that has no tracked event. Past Bookings and already-tracked Bookings are skipped, so the operation is safe to repeat.
- **Projection contract.** Event body: `summary` is `client_name — service name`, falling back to `event_type`, then `Booking`; `location` is `venue` when non-empty; `description` is plain Indonesian-labelled lines for every non-empty Booking field (client, phone, service, event type, Headcount, venue, Style, Reference, notes, total, DP) plus the Booking id; `start`/`end` are the Booking date and `HH:MM` values rendered as RFC 3339 with an explicit `+07:00`; `status` is `confirmed`; `transparency` is `opaque`; reminders use the calendar default; `attendees` is absent. No all-day events exist because Blocks are out of scope.
- **Authentication.** A Google service account is the mirror's identity. The owner shares the dedicated calendar with the service-account address and grants "Make changes to events". Credentials are server-only environment values: service-account email, private key, calendar id, plus a cron secret. No OAuth consent screen and no refresh token are involved, which avoids testing-status token expiry. The private key's newlines are supplied escaped and normalised in code.
- **Server boundary.** Admin writes stay in the browser as they are today; the browser never holds a Google credential. After a successful write the Booking manager enqueues mirror work through an admin-only table and calls a Node-runtime route that verifies the admin's Supabase access token, drains the queue, and returns per-Booking results. A cron route authenticated by the shared secret drains leftovers and runs reconcile. Both composition roots stay thin; all behaviour lives behind the two seams below.
- **Persistence.** Three admin-only tables: a single-row connection record (enabled flag, calendar id, last verified time, last error), tracked mirrored events (one per Booking, Google event id, last synced timestamp), and a work queue (Booking reference, attempt count, next attempt, last error, processed timestamp). RLS allows the authenticated role and has no anonymous policy. The queue and tracked-event rows deliberately do **not** cascade with the Booking: a hard delete must still be able to remove the Google event, and reconcile removes orphaned tracked rows after the Google event is gone.
- **State derivation.** Per-Booking state is derived, not hand-set: Synced when a tracked event exists and no open queue row; Pending when an unprocessed queue row exists; Failed when the last attempt recorded an error. The Booking manager reads these alongside the existing Booking list.
- **Failure handling.** A Google failure never throws into the Booking write path. The queue row stays open with its error and is retried on the next drain and by the daily cron; the connection record records the latest error for the banner. Retry is unbounded but coalesced: repeated saves for one Booking do not stack duplicate work, they refresh the same pending intent.
- **Reconcile.** The daily job covers today-forward only. It creates missing tracked events for confirmed Bookings, updates existing ones from current Booking data, deletes Google events whose Booking is gone or no longer confirmed, removes orphaned tracked rows, and drains the queue. Past mirrored events are left as history. The same routine backs the manual "Resync semua" action for the current and future window.
- **Disconnect.** Disconnecting clears the enabled flag; the browser stops enqueuing and the server refuses to drain. Existing events stay in Google. There is no automatic bulk delete; reconnecting triggers backfill/reconcile again.
- **UI.** The admin settings area gains a Google Calendar section with configuration status, connection test, enable/disable, disconnect, last sync, last error, and "Resync semua". The Booking manager gains the derived state badge with retry. The dashboard shows a banner while the connection is enabled but unhealthy. All copy is Indonesian; "Sinkron" may appear in UI labels but is not domain language.
- **Environment example.** The example env file documents the four server-only values without real secrets; the deployment notes call out that they must be set on the host and never prefixed `NEXT_PUBLIC_`.
- **No public surface changes.** No new public RPC, no change to `get_month_availability` or `get_day_schedule`, no PII added to the public calendar, no realtime subscription.

## Testing Decisions

- **What makes a good test.** Assert external behaviour that the owner can observe: the Google event body for a given Booking, which mirror action a given Booking state implies, what the queue does after a success or a failure, and the SQL shape that enforces one event per Booking and admin-only access. Tests must not reach into component internals, route plumbing, or Google client implementation. Include adversarial cases that would silently break the projection: service unlinked, blank optional fields, a long Reference, a past Booking, a cancelled Booking, an orphaned tracked event.
- **Seam 1 — pure projection and planning.** A pure module turns a Booking plus a service name into the Google event body, and turns confirmed Bookings plus tracked events into create/update/delete actions with the WIB today-forward cut-off applied. Verified with shapes in, asserted shapes out, in the style of the existing day-schedule and availability suites.
- **Seam 2 — mirror adapter with an injected Google port.** A small `GoogleCalendarPort` (create/update/delete/list-owned, plus a cheap calendar access check) is injected into the connection, drain, and reconcile functions, alongside the existing Supabase client type. Tests use a fake port and the repo's loose client mock: event id stored on create, update reuses the stored id, exit from confirmed deletes, Google failure leaves a Failed queue row without throwing, a second drain retries, backfill skips past and already-tracked Bookings, reconcile deletes orphans and leaves past events, disconnect refuses to drain.
- **Persistence.** Declarative SQL tests assert the three tables, their single-event-per-Booking invariant, admin-only RLS, no anonymous policy, and the deliberate non-cascade behaviour, following the invoice-schema suite's approach.
- **Not tested here.** Route handlers, cron wiring, the admin settings section, the Booking badge, and the dashboard banner have no prior test pattern in this repo; they are covered by typecheck, production build, and manual QA against a real calendar. This keeps the seam count at two.
- **Test modules.** The projection/planning module, the adapter module, and a declarative schema suite. Same Vitest directory and style as the existing admin-* and pure-logic suites; no live Google calls in CI, no live database.
- **Prior art.** `src/lib/__tests__/admin-bookings.test.ts` for injected-client adapters, `day-schedule.test.ts` for pure mapping, `invoice-schema.test.ts` for declarative SQL invariants.

## Out of Scope

- Two-way mirroring: Google events never block public availability, and Google-side edits/deletes never change a Booking or Block.
- Mirroring Blocks, full dates, pending/cancelled Bookings, Booking Requests, or Invoices.
- Any all-day event, recurring event, colour override, custom reminder, or attachment.
- Inviting clients or any attendee by email.
- Backfilling past Bookings; correcting events that have already passed.
- A bulk "delete all mirrored events" action.
- Multiple calendars, multiple Google accounts, multiple admins, or per-admin calendars.
- An ICS feed; the mirror uses the Calendar API.
- Realtime refresh of open tabs; the existing schedule-changed event is unchanged.
- Changing validation, conflict guards, invoice lifecycle, booking-request intake, or public calendar behaviour.
- Google Cloud project setup being automated by the app; it remains a documented human checklist.

## Further Notes

- The owner must complete the console checklist once: create a Google Cloud project, enable the Calendar API, create a service account, download its JSON key, create the "MUA — Booking" calendar, and share it with the service-account address as "Make changes to events". If the calendar does not exist yet, creating it is the first checklist line. The connection test should fail loudly if the share is read-only.
- Service-account credentials rotate by replacing environment values and redeploying; there is no token to store or expire, and no seven-day testing-mode expiry.
- Vercel cron runs the daily reconcile (suggested `0 17 * * *`, midnight WIB) and is protected by the shared secret. The cron must remain safe to run at any time and safe to run twice.
- Known limitation, accepted deliberately: Google can lag during an outage, and a hand-edited event stays wrong until the next reconcile or Resync. The dashboard, the queue, and the public calendar are always correct.
- The public calendar still derives availability from confirmed Bookings plus Blocks and full dates; the mirror excludes the latter two, so Google is a client-work list, not a full timetable. The ADR records this trade-off.
- Build order: schema and connection (ticket 01), projection plus lifecycle plus queue plus UI state (ticket 02), reconcile plus cron plus resync (ticket 03). Ticket 02 depends on 01; ticket 03 depends on 02.
- Related: `GLOSSARY.md` term **Calendar Mirror**; `docs/adr/0004-google-calendar-is-a-one-way-booking-mirror.md`.
