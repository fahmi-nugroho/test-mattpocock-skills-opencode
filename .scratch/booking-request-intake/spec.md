# Spec: Format Booking Link and Booking Requests

Status: ready-for-agent

## Problem Statement

As the makeup artist, once a client has decided to book I send them a text format to fill in (name, date, event, headcount, hairdo, location, WhatsApp number, start and finish times), and they answer inside WhatsApp. I then retype every line into the admin booking form by hand. The retyping is slow and error-prone, and the lines the booking form has no room for — event, headcount, hairdo, venue, and the DP / total / settlement figures — end up buried in a chat thread instead of living with the booking. The date and times are the worst part, because they are the two things that must be exactly right and are the easiest to mistype.

## Solution

When a client has decided to book, the admin sends a **Format Booking link** instead of a block of text. The link carries a per-request token and opens a short Indonesian form on the client's phone, prefilled with the date and times already agreed in chat, asking only for the client's own details. Submitting it writes a **Booking Request**, which appears in a new admin **Permintaan** section; the admin accepts it with one action into the existing booking form, so the normal validation and conflict guards still run and the booking is created exactly as if it had been typed by hand. Money and status stay entirely with the admin; a submitted request never reserves the slot; the public calendar and its privacy contract are unchanged.

## User Stories

**Client**

1. As a client, I want to receive a link from the artist once we have agreed to book, so that I do not have to fill in a long text format by hand.
2. As a client, I want to open that link on my phone and see a short form, so that I can finish it in about a minute.
3. As a client, I want the date and times we discussed already filled in, so that I do not retype them and cannot mistype them.
4. As a client, I want to adjust the prefilled date or times when things have changed, so that the request matches what we actually agreed.
5. As a client, I want fields for my name, WhatsApp number, event, number of people, hairdo, and makeup location, so that the artist has everything she needs before the day.
6. As a client, I want to be warned when the time I chose clashes with something already on the calendar, so that I do not ask for an impossible slot.
7. As a client, I want that clash to be a warning rather than a refusal, so that I can still ask when the only time that works for me overlaps.
8. As a client, I want to be told plainly that the slot is not locked until the down payment arrives, so that I do not assume I am already booked.
9. As a client, I want to see no price anywhere on the form, so that I am not confused about what I owe — the price is agreed in chat.
10. As a client, I want a clear confirmation after I send the form, so that I know it arrived.
11. As a client, I want the form to tell me my request was already sent if I open the link again, so that I do not submit it twice.
12. As a client, I want a clear message when the link has expired, so that I know to ask the artist for a new one.
13. As a client, I want the form to work well on a small screen and to be written in Indonesian, so that filling it in is effortless.
14. As a client, I want to be told inline which field is missing or malformed, especially my phone number, so that I can fix it before sending.
15. As a client, I want the other clients' names, numbers, notes, and reasons to stay hidden, so that I trust the site with my own details.
16. As a client, I want my request to go only to the artist and never to appear anywhere public, so that my address and number stay private.

**Admin**

17. As an admin, I want a "Permintaan" section separate from my bookings, so that unfinished client submissions never mix with confirmed work.
18. As an admin, I want to generate a Format Booking link for a client, so that I can send it in the chat I am already having.
19. As an admin, I want to fill in the date and times on that link when they are already agreed, so that the client does not retype them.
20. As an admin, I want to leave the date and times blank when nothing is agreed yet, so that the client can propose them.
21. As an admin, I want a "Salin link" action, so that I can paste the link into WhatsApp myself.
22. As an admin, I want an optional WhatsApp number field that opens WhatsApp with the link prefilled, so that sending is one tap when I am at my desk.
23. As an admin, I want a count badge for requests that need my attention, so that I notice them without any live updates.
24. As an admin, I want to open a request and read its full detail (client, phone, event, headcount, hairdo, venue, requested date and times), so that I can decide.
25. As an admin, I want "Jadikan Booking" to prefill my existing booking form from the request, so that I do not retype anything.
26. As an admin, I want that prefilled booking to pass my existing validation and conflict guards, so that no shortcut can bypass the rules.
27. As an admin, I want the total and the down payment to remain mine to type, so that a client can never set a price.
28. As an admin, I want the status (pending, confirmed, cancelled) to remain mine to change, so that nothing confirms itself.
29. As an admin, I want an accepted request to be kept and linked to the booking it produced, so that I have an audit trail and cannot accept the same request twice.
30. As an admin, I want to see whether each request is still open, already submitted, accepted, or expired, so that I chase the right ones.
31. As an admin, I want the headcount recorded on the booking, so that I know how long and how big the job is.
32. As an admin, I want the suggested total (service price multiplied by headcount) prefilled when I pick a service, so that I can accept or override the negotiated figure.
33. As an admin, I want the event type, venue, and hairdo saved on the booking, so that logistics and style are known on the day.
34. As an admin, I want to keep creating bookings by hand exactly as I do today, so that clients who never use the link are unaffected.
35. As an admin, I want an old link to fail safely, so that it cannot be replayed or resurrected later.
36. As an admin, I want a formula for the remaining balance rather than a second stored figure, so that the total, the DP, and the remaining amount can never disagree.
37. As an admin, I want the link to be single-use, so that a client cannot silently rewrite a request I have already read.
38. As an admin, I want the whole intake to work without email, push, or WhatsApp automation, so that it runs on the same simple deployment as everything else.

**Quality and safety**

39. As the artist, I want a token that cannot be guessed, so that no one can read or submit against someone else's request.
40. As the artist, I want malformed or oversized submissions rejected, so that junk cannot reach my database through the new public entry point.
41. As the artist, I want the public calendar's occupancy rule untouched, so that only confirmed bookings continue to occupy the day.

## Implementation Decisions

**Domain vocabulary (first `GLOSSARY.md` entries)**

- **Format Booking** — the link plus the form the admin sends once a client has decided. A message artifact, never a stored row.
- **Booking Request** — the stored submission a client sends back through a Format Booking link. It can never occupy the calendar, never carries a price, and is accepted into a Booking by the admin.
- **Booking** — unchanged: admin-created, `pending → confirmed → cancelled`, and only `confirmed` occupies the calendar.
- **Headcount** — the number of people to be made up in one booking. One service per booking; the price is multiplied by headcount.
- **Remaining balance** — `total_price − dp_amount`, always derived, never stored.
- No `Inquiry` term: nothing about this feature is a read-only question.

**Schema changes**

`bookings` gains six columns:

- `event_type text not null default ''`
- `headcount integer not null default 1` with `check (headcount >= 1)`
- `venue text not null default ''`
- `hairdo text not null default ''`
- `total_price integer` (nullable, `check (total_price is null or total_price >= 0)`; null means "not quoted yet")
- `dp_amount integer not null default 0` with `check (dp_amount >= 0)`

No settlement column — the remaining balance is derived. The existing `date` + zero-padded `"HH:MM"` text rule for the calendar seam is unchanged; the new columns are plain scalars and do not participate in the availability derivation.

New `booking_requests` table:

- `id uuid` primary key
- `token text not null unique` — a database-generated 128-bit random value, distinct from the row id so the id is never enumerable
- `created_at timestamptz not null default now()`
- `expires_at timestamptz not null` — set to creation plus seven days
- `submitted_at timestamptz` — null until the client submits
- `accepted_booking_id uuid` referencing `bookings(id)` on delete set null, unique so one request produces at most one booking
- client fields: `client_name text not null default ''`, `client_phone text not null default ''`, `event_type text not null default ''`, `headcount integer not null default 1` (check `>= 1`), `venue text not null default ''`, `hairdo text not null default ''`, `notes text not null default ''`
- requested slot: `date date`, `start_time text`, `end_time text` (nullable, since the admin may generate the link before anything is agreed)

`timestamptz` is used only for the token bookkeeping columns (`created_at`, `expires_at`, `submitted_at`). They are server-side facts and are never compared as a local wall-clock window, so the reason the calendar uses date-plus-text does not apply to them.

**Row-level security**

`booking_requests` follows the existing pattern exactly: no policy for the anonymous role, full CRUD for the authenticated role. The public never touches the table directly; it goes through two security-definer functions.

**Public API contracts (the project's first public write path)**

- A read function returning the form's context for a valid token, and a null/expired signal otherwise. It returns only what the admin typed on the link: the client's name or handle if the admin supplied one, and the requested date, start, and end. It never returns a price, and never returns another client's data. It refuses to return context for a token that is already submitted or expired.
- A submit function taking the token plus the client's own fields. It is security-definer, validates the token (exists, not expired, not already submitted), validates the payload fail-closed (non-empty name, phone of at least nine digits, headcount at least one, date and times in the expected formats when present, start before end), writes only the client-owned columns, and sets `submitted_at`. It never writes price, status, or anything else the admin owns.
- Execute is granted to the anonymous role for both; nothing else about the table is exposed.

**Format Booking link and message**

The link is a route keyed by the token. The admin message reuses the existing WhatsApp deep-link builder, so the Format Booking message is one more template alongside the existing general, service, date, and date-plus-time starters, in Indonesian, containing the link.

**Client form behaviour**

- Short Indonesian form with the six client fields plus the requested slot.
- The slot is prefilled from the link when the admin set it, left empty when not, and always editable by the client; whatever the admin finally decides governs.
- The clash warning reuses the existing public day-schedule read and the existing half-open overlap rule used by the calendar popup's time picker. It warns and never blocks submission.
- A sentence stating that the slot is not locked until the down payment arrives.
- Distinct states: loading, ready, sent-confirmation, already-submitted, expired, and error, with Indonesian copy consistent with the existing calendar popup.
- Inline field errors mirror the existing form-validation style; the same rules are re-enforced inside the submit function.

**Admin behaviour**

- A "Permintaan" section alongside the existing sections, listing requests with their derived state and a count badge for those needing attention. No realtime and no push; the badge refreshes on load, consistent with the rest of the dashboard.
- Creating a Format Booking request: optional client name, optional WhatsApp number, optional date, start, and end; a "Salin link" action and an optional "open WhatsApp with the link prefilled" action using the existing WA number handling.
- "Jadikan Booking" maps a submitted request into the existing booking form's fields: client name, phone, date, start, end, event type, headcount, venue, and hairdo. It leaves `service_id`, `notes`, `total_price`, `dp_amount`, and `status` for the admin. When a service is chosen, the form suggests `service.price_idr × headcount` as the total; the suggestion is never saved automatically.
- Saving still runs the existing booking validation and conflict guards unchanged.
- Accepting links the request to the created booking; a deleted booking releases the link so the request can be accepted again.
- Expired links cannot be accepted or submitted.

**Derived request state** — `open` (not submitted, not expired), `submitted`, `accepted`, `expired`, derived from the row's timestamps and the link, never a stored status column.

**Copy and locale** — Indonesian labels and errors throughout, reusing the existing date and IDR formatters.

## Testing Decisions

- A good test asserts externally visible behaviour only: given a raw public payload, assert the accepted shape or the rejection; given a stored request row and a clock, assert the derived state; given a request, assert the booking-form draft it produces; given a WhatsApp number and a link, assert the URL; given a mocked client, assert the table and payload written; given a migration file, assert the declared schema. No live database, no component internals, no snapshots.
- Modules tested: the pure request helpers (payload validation, row mapping with key-stripping, state derivation, Format Booking message and link building, request-to-booking draft including the suggested total) and the admin and public data-access wrappers with an injected mock client, plus an extension of the existing declarative SQL verify test for the new migration.
- Prior art: existing pure validators, the calendar popup's day-schedule row mapping with its deliberate key stripping, the derived day status, the WhatsApp link and message builders, the admin bookings CRUD with injected client, the public RPC wrappers, and the declarative migration contract test.
- Agreed seam with user: three existing seam types — pure helpers, adapter wrappers with an injected mock client, and declarative SQL verify. No new test infrastructure. Notably there is **no parsing seam**, because the link design deletes text parsing entirely, which is the single largest testing saving in this feature. The form page and the admin section are covered by manual QA, as with every other UI in this repo.

## Out of Scope

- Parsing the old text format. The link exists precisely so that no parser is needed.
- WhatsApp Cloud API, webhooks, or any reading of chat messages.
- Any price, DP, or total on the client-facing form.
- Automating status from money: no payment gateway, no webhook, no automatic confirmation.
- A payment lifecycle — recording when the DP arrived, part-payments, settlement tracking, reminders. That belongs to the invoices topic.
- Slot holds or reservations: a submitted request does not occupy the calendar.
- Attachments or image upload on the form — client fields stay text.
- Client accounts, sign-in, or the ability for a client to edit or cancel a submitted request.
- Email, push, or WhatsApp notifications when a request arrives; realtime refresh.
- Reintroducing operating hours, or changing the occupancy rule or the admin overlap guards.
- Multi-service bookings or per-person pricing on the service record.
- Multiple admins or roles.

## Further Notes

- This deliberately reopens what the calendar popup spec left out of scope ("booking creation … out of scope"), and it introduces the project's first public write path. That trade-off is recorded in [`docs/adr/0002-booking-request-intake.md`](../../docs/adr/0002-booking-request-intake.md): intake through a token link and a Booking Request table, rather than parsing the WhatsApp text or wiring the WhatsApp API.
- The occupancy rule from the earlier days remains exactly as-is: only confirmed bookings occupy, and the hours-removal ADR is untouched — no operating window comes back.
- Glossary terms this creates, for the first `GLOSSARY.md`: Booking, Format Booking, Booking Request, Headcount. Each entry must stay free of implementation detail.
- Build order: 1) schema foundation (table, new columns, RLS, SQL verify); 2) the two public functions plus their wrappers and the payload validator/mapper; 3) the client form page with prefill, clash warning, and all states; 4) the admin "Permintaan" section with token generation, the Format Booking message, and accept-into-booking; 5) glossary and ADR.
- Tickets for this feature live at `.scratch/booking-request-intake/issues/`: 01 `01-schema-foundation.md`, 02 `02-public-request-rpcs.md`, 03 `03-format-booking-form.md`, 04 `04-admin-permintaan-accept.md`, 05 `05-glossary-and-adr.md`.
- Reachable everywhere as a first contact point? No: the client only sees the form after the admin sends the link, so the landing's existing shortcuts and the general WhatsApp starters are unchanged.
