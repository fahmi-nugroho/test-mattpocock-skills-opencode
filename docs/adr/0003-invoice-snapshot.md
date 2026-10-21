# ADR-0003: Invoices are frozen snapshots, many per Booking

Status: accepted

Date: 2026-10-21

## Context

Before this decision the admin built each invoice by hand in a design app: she
retyped the client, event, headcount, venue, hairdo, times, price, DP and
balance from the Booking into a picture, then sent that picture back into the
WhatsApp conversation. Every payment and every change to the Booking produced
another picture, so one client could hold several, and the old ones were
impossible to find when the client asked for a copy. Meanwhile the Booking kept
moving in the dashboard, so the newest picture and the stored Booking could
disagree, and nothing in the system recorded what was actually sent.

The feature had to reproduce those pictures from stored data, keep every copy,
and make "send me the one before I paid" one tap. That forces a choice: is an
Invoice a view of the current Booking, or a record of what was true when it was
issued?

## Decision

An Invoice is a numbered, dated frozen snapshot of one Booking, and a Booking
may have many.

- `invoices` stores its own copy of every displayed Booking field and payment
  amount at issue time; `create_invoice` builds that copy from the Booking row
  in the same transaction. The picture is laid out from the saved row, never
  from the live Booking.
- Issue is a separate action with its own number from the one `invc-NN/YYYY`
  series. The year comes from the issue date, and an issue date may not leave
  that year. The next number is `max(seq) + 1` under an advisory lock on the
  year, not `count + 1`.
- `sent_at` is the only stored lifecycle state. The
  `invoices_guard_lifecycle` trigger refuses a direct delete of a sent row and
  freezes every other field; only `sent_at` itself may still change, which is
  how the admin marks and unmarks an Invoice explicitly.
- The screen refuses to issue a snapshot identical to the newest Invoice for
  that Booking, names the existing number and tells the admin to resend it.
  That guard lives with the screen because it needs the loaded list; the
  database enforces the invariants that must hold for any write.
- There is one document type. Settling changes the derived Payment Status to
  `Lunas`; it does not produce a second kind of document or a second series.
- Old Invoices stay in the per-Booking list newest first, each keeping its
  number, dates, snapshot and sent mark, and can be downloaded or shared again.
  Nothing is public: the picture exists only in the admin's browser.

## Alternatives considered

1. **One live Invoice per Booking, rendered from the current Booking.**
   Rejected: it would rewrite history every time the admin edited the Booking
   or recorded a payment, so a client's copy could not be checked against the
   system and an earlier version could never be re-sent.
2. **A draft that follows the Booking until it is sent, then freezes.**
   Rejected: the preview must be exactly what is saved, and its dates may be
   corrected before sending; a row that changes under the preview cannot
   satisfy both. It also leaves the saved Invoice ambiguous whenever the
   Booking changes between preview and send.
3. **Keep only the rendered PNG.** Rejected: an image cannot be re-rendered at
   2× after WhatsApp's recompression, cannot be listed or inspected by amount
   and status, cannot have a date corrected, and does not survive a change of
   layout or fonts. The snapshot is the record; the PNG is a derivative.
4. **One Invoice number with revision history.** Rejected: the client refers to
   a number, so a revision model needs a mutable "current" pointer and still
   has to keep every delivered revision. Many numbered Invoices say the same
   thing with simpler writes, simpler re-send, and no rewriting.

## Consequences

- A Booking can own several numbers, so the series counts documents issued,
  not jobs booked. Corrections and "the details changed" legitimately consume
  numbers, which is numbering noise; the per-Booking list, not the number, says
  what is current.
- A re-send is a first-class path, not a reissue: the newest-first list exposes
  every old Invoice with share and download. The duplicate guard stops a re-send
  from minting a duplicate number, and the admin is shown the existing number
  she should send instead.
- Number reuse follows `max(seq) + 1`: deleting the newest unsent Invoice frees
  its number, while deleting a middle one leaves a gap. A sent Invoice cannot
  be deleted directly, but it can be removed after the admin explicitly clears
  its sent mark, or when its Booking is deleted and the cascade removes it.
  Either path can make its number the next one allocated, so a number
  identifies an issued document, not a permanently reserved slot.
- Booking edits after issue change nothing in a saved Invoice, including a
  deleted service, whose name falls back to empty at issue time. This is the
  property the frozen-snapshot test pins.
- The duplicate rule is only a UI guard. There is one admin and no concurrent
  editor, but a direct `create_invoice` call could still issue the same
  snapshot twice. The constraints make such a duplicate well-formed, not
  impossible.
- Storage grows by one row per issue. That is small at this business's volume
  and is the price of keeping every copy.
- This is hard to reverse. Once Invoices have been sent, the snapshot columns
  are the only record of what the client holds; a live view would have nothing
  to compare against. Dropping the snapshot and rendering from the current
  Booking would silently change historical documents and cannot reconstruct
  them, so a later simplification must keep the snapshot path for existing
  rows and would be a new decision, not a cleanup.
