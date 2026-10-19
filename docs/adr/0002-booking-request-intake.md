# ADR-0002: Intake through a per-request token link and a Booking Request

Status: accepted

Date: 2026-10-18

## Context

Once a client decided to book, the admin sent a text format to fill in
and the client answered inside WhatsApp. The admin then retyped every line
into the admin booking form by hand. The retyping was slow and error-prone,
the details the form had no room for — event type, headcount, hairdo,
venue — ended up buried in a chat thread instead of living with the
booking, and the date and times, the two things that must be exactly
right, were the easiest to mistype.

The obvious repair is to have the client enter the details once. That
raises two questions: where the client enters them, and how the entry
reaches the admin. It also forces a first for this project: until now
every write went through the admin's authenticated session and the public
site was read-only. Any client-facing intake is the first public write
path, so how it is exposed matters as much as what it stores.

## Decision

Intake is a per-request token link plus a Booking Request.

- The admin generates a link carrying a per-request token, optionally
  prefilled with the date and times already agreed in chat, and sends it
  in the existing WhatsApp conversation.
- The client opens the link and fills a short form. Submitting it stores a
  Booking Request — the client's own details plus the requested time —
  which the admin accepts into a Booking through the existing booking
  form, so the normal validation and conflict guards still run.
- A Booking Request is a proposal, never a commitment: it never occupies
  the calendar and never carries a price. A Booking is created only by the
  admin, and an accepted request is kept as a link to the booking it
  produced, so one request can be accepted at most once.
- The public reaches intake through two purpose-built functions only,
  never the underlying data: both validate the token, and the submit
  function validates the payload fail-closed. This is the project's first
  public write path.

Alternatives considered:

1. **Parsing the old WhatsApp text.** The format is free-form human text,
   so a parser would have to guess names, event types, venues, hairdos,
   and — worst of all — the date and times from prose. That is the
   category of error this change exists to remove, and it would add a
   whole new test seam for a fragile format. Rejected: the link deletes
   text parsing entirely, which the spec calls the single largest testing
   saving in the feature.
2. **The WhatsApp Cloud API / webhooks.** Reading chat messages
   automatically needs the business API, a public webhook endpoint,
   message templates and permissions, and a new operational surface to
   run and secure. The product requires intake to run on the same simple
   deployment as everything else, with no email, push, or WhatsApp
   automation. Rejected as disproportionate to the problem.

## Consequences

- The project gains its first public write path. That is the deliberate
  cost of the trade, and it is contained by routing all public access
  through two security-definer functions while the Booking Request itself
  stays invisible to the anonymous role.
- A submitted request never reserves the slot, and a client can never set
  a price or a status. Money and the booking lifecycle remain entirely the
  admin's, and accepting a request runs the same validation and conflict
  guards as a hand-typed booking.
- The admin can keep creating bookings by hand exactly as before; clients
  who never open a link are unaffected.
- This does not contradict ADR-0001. Operating hours stay removed and no
  operating window returns; the date-plus-`HH:MM` calendar seam is
  untouched, the new booking fields are plain scalars outside it, and only
  confirmed bookings occupy the calendar exactly as ADR-0001 left it.
