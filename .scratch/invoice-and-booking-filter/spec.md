# Spec: Invoices and Booking Status Filters

Status: ready-for-agent

## Problem Statement

As the makeup artist, I confirm a booking in WhatsApp with a price and a down payment, and then I have to tell the client what they owe. Today that means building the invoice by hand in a design app: retyping the client's name, the event, the headcount, the venue, the hairdo, the times, the price, the DP and the remaining balance into a picture, then sending that picture back into the same chat. Every payment creates another one of these, and every change to the booking details creates another one too, so the same client can hold several pictures that all had to be retyped from data the admin already stores.

The retyping is slow and it drifts: the booking is edited in the dashboard while the picture says something else, a DP is recorded but the picture still asks for the old remaining balance, and the old pictures become impossible to find when a client asks for a copy. Nothing on the admin side can produce, keep, or reproduce what the client was actually sent.

Separately, finding a booking in the dashboard means reading the whole list. There is a search box and a Mendatang/Riwayat split, but no way to say "show me only the ones still waiting for confirmation".

## Solution

The admin can issue an **Invoice** from a booking: a dated, numbered picture of that booking's details and payment position at that moment, generated from the data already on the booking plus the payment details configured once in settings. Issuing takes one action from the booking row; the picture is previewed, edited only in its two dates, and sent to the client through WhatsApp with the phone's own share sheet.

An Invoice is a **frozen snapshot**, never a live view: several can exist for one booking — one when the DP is recorded, one when the booking is settled, one whenever the details change — and each one keeps showing exactly what the client was told, even after the booking moves on. Old ones stay reachable, re-downloadable and re-sendable, so "can you resend the one before I paid?" is one tap. Issuing an identical invoice, or any invoice before a DP exists, is refused with an explanation.

The bookings dialog also gains status chips — Semua, Menunggu, Terkonfirmasi, Dibatalkan — that narrow the list alongside the existing search while leaving the Mendatang/Riwayat split intact.

Nothing about this is public: the invoice is built in the admin's browser and leaves only as an image the admin sends herself. No new public route, no WhatsApp automation, no payment gateway.

## User Stories

**The client receiving an invoice**

1. As a client, I want to receive a single clear picture that states my booking and what I owe, so that I do not have to piece it together from a chat thread.
2. As a client, I want to see my name, my event, the date and times, the venue, the headcount and the style on the same sheet, so that I can check the artist has the day right.
3. As a client, I want to see the agreed total, what I have paid as a DP, and what is still outstanding, so that I know exactly what to transfer.
4. As a client, I want a clear "lunas" indication once nothing is outstanding, so that I can tell the booking is settled without doing arithmetic.
5. As a client, I want the bank, account name and account number printed on the invoice, so that I can pay from the same message.
6. As a client, I want the invoice to tell me the payment is not refundable, so that there is no misunderstanding later.
7. As a client, I want a date of issue and a due date, so that I know when the money is expected.
8. As a client, I want a numbered, dated invoice rather than an unnamed picture, so that I can refer to it and see which one is newer.
9. As a client, I want to keep an older invoice after the details change, so that I still have the reference of what was agreed before.
10. As a client, I want the invoice to look like the one I already receive today, so that nothing about the transaction feels unfamiliar.
11. As a client, I want the picture to be readable on a phone without zooming, so that I can check it in the chat.
12. As a client, I want the invoice to contain only my own booking, so that I never see another client's details.
13. As a client, I want to receive the invoice in the WhatsApp conversation I am already having, so that I do not need an account, a link, or an app.

**The admin issuing an invoice**

14. As an admin, I want to create an invoice from a booking in one action, so that I never retype the client's details.
15. As an admin, I want the invoice to use the agreed total on the booking rather than a recalculated price, so that the number the client agreed is the number they see.
16. As an admin, I want the invoice to show the DP I have recorded as the amount paid so far, so that a new invoice after a payment tells the client the truth.
17. As an admin, I want the remaining balance to be derived from total minus DP, so that the two figures can never disagree.
18. As an admin, I want the invoice to state whether the client has paid a DP or is settled, derived from those same figures, so that nothing on the picture is a guess.
19. As an admin, I want the issue date to default to today, so that issuing needs no typing.
20. As an admin, I want the due date to default to the booking date, so that the client is asked to pay before the event.
21. As an admin, I want to change the due date before sending, so that I can ask for a DP earlier when the event is far away.
22. As an admin, I want to change the issue date only within the invoice number's year, so that a number is never silently renumbered into another year.
23. As an admin, I want to be refused with a clear reason when the booking has no agreed total, so that I fix the booking instead of sending a blank amount.
24. As an admin, I want to be refused when no DP is recorded yet, so that an invoice only ever confirms money that actually arrived.
25. As an admin, I want to be refused when the booking is cancelled, so that no invoice is issued for work that is not happening.
26. As an admin, I want to be refused when the new invoice would be identical to the last one I issued, so that I resend the existing one instead of minting a duplicate number.
27. As an admin, I want the invoice number to be allocated automatically, in one series, restarting each January, so that I never type or compute it.
28. As an admin, I want the number to be safe against two invoices being created at the same moment, so that the series has no duplicates.
29. As an admin, I want to preview the generated picture before sending, so that I can catch a wrong date or amount first.
30. As an admin, I want the preview to be drawn from the saved invoice, so that what I see is exactly what is stored.

**The admin sending and keeping invoices**

31. As an admin, I want a "Bagikan" action that opens the phone's share sheet with the picture, so that sending to WhatsApp is one tap on my phone.
32. As an admin, I want a download action that works on a desktop browser, so that I can attach the picture to the chat by hand.
33. As an admin, I want to open the WhatsApp chat from the same screen even when sharing files is unavailable, so that the two-step path is still short.
34. As an admin, I want to mark an invoice as sent myself, so that the dashboard never claims something was delivered when it was not.
35. As an admin, I want to unmark it, so that a wrong chat or a cancelled share can be corrected.
36. As an admin, I want to see every invoice belonging to a booking, newest first, with its date, DP, remaining balance and sent state, so that I know what the client holds.
37. As an admin, I want to reopen an older invoice and resend or download it, so that a client's request for a copy is one tap.
38. As an admin, I want to delete an invoice I created by mistake, behind a two-click confirmation, so that a wrong document does not clutter the history.
39. As an admin, I want an issued invoice to stay untouched when I later edit the booking, so that history matches what the client was told.
40. As an admin, I want the booking row to tell me how many invoices exist and which one is newest, so that I do not open the list to find out.
41. As an admin, I want to reach invoices from the booking they belong to, so that I do not hunt through a separate ledger.

**The admin filtering bookings**

42. As an admin, I want chips for Semua, Menunggu, Terkonfirmasi and Dibatalkan, so that I can see only the bookings in the state I care about.
43. As an admin, I want the chips to work together with the search box, so that "confirmed bookings for Sari" is one narrowing, not two.
44. As an admin, I want the Mendatang/Riwayat split to survive filtering, so that a cancelled future booking still appears under Mendatang.
45. As an admin, I want the counts on the list trigger to keep summarising all bookings, so that the number does not appear to change when I filter.
46. As an admin, I want each chip to open a single page of results, so that a narrowed list is not scrolled halfway down.
47. As an admin, I want the chips to be keyboard operable, so that I can filter without a mouse.
48. As an admin, I want a filtered list that matches nothing to say so plainly, so that I do not think my data is gone.

**Quality, safety and configuration**

49. As the business owner, I want my bank details and Instagram handle stored once in settings, so that every invoice prints the same information.
50. As the business owner, I want those details editable without a deploy, so that a changed account is one form away.
51. As the business owner, I want invoices to be readable only by the signed-in admin, so that no client's booking or payment state is public.
52. As the business owner, I want invoices removed when their booking is deleted, so that no orphaned document survives the work it describes.
53. As the business owner, I want the picture to remain legible when WhatsApp recompresses it, so that the client can still read the amounts.
54. As the business owner, I want a font that fails to load to degrade gracefully rather than block the invoice, so that issuing never gets stuck.
55. As the business owner, I want the rest of the calendar, booking and Format Booking behaviour untouched, so that this feature cannot break what already works.
56. As the business owner, I want no email, push, or WhatsApp automation added, so that the deployment stays as simple as it is.

## Implementation Decisions

**Domain vocabulary**

- **Invoice** — a dated, frozen statement of a Booking's details and payment position at the moment it was issued, sent to the client as a picture. Many per booking; issued when the DP is recorded, when the booking is settled, or when its details change. Never rewritten.
- **Invoice Number** — `invc-NN/YYYY`, one series for the business, restarting each January, allocated only by the business.
- **Payment Status** — derived, never stored: `Lunas` when the DP is at least the subtotal, otherwise `DP diterima`.
- `Booking` and `Headcount` keep their existing meanings; `Headcount` gains a caveat that the agreed total is what an Invoice prints, not price × headcount.
- No `Bill`, `Receipt`, `Kwitansi`, or `Tagihan` term: there is one document and it is an Invoice.

**Data model**

A new admin-only `invoices` table, following the `booking_requests` privacy pattern: no policy for the anonymous role, full access for the authenticated role.

- `id`, `created_at`.
- `booking_id` — required, references `bookings(id)` with `on delete cascade`.
- `year`, `seq`, `number` — `number` is unique and formatted `invc-NN/YYYY`; `(year, seq)` is unique.
- `issued_on`, `due_on` — dates, with `due_on >= issued_on`.
- `sent_at` — nullable timestamptz; the only state an invoice has.
- Snapshot columns copied at issue time: `client_name`, `client_phone`, `service_name`, `event_type`, `headcount`, `venue`, `hairdo`, `booking_date`, `start_time`, `end_time`, `subtotal`, `dp_amount`.
- Constraints: `subtotal >= 0`, `dp_amount > 0`, `dp_amount <= subtotal`, and the existing `HH:MM` shape for the two times.
- Index on `(booking_id, year desc, seq desc)` for the per-booking list.

`settings` gains four columns: `bank_name`, `account_name`, `account_number`, `instagram_handle`, all non-null with an empty-string default. They stay behind the admin-only settings policy; no public function exposes them.

**Number allocation**

A database function creates an invoice from a booking id plus the two dates. It takes a transaction-scoped advisory lock on the year, computes `max(seq) + 1` for that year, and inserts. Allocation is "highest + 1" rather than "count + 1" precisely so that deleting an unsent invoice frees its number for the next one instead of leaving a silent gap. The number's year comes from the issue date; this is why an unsent invoice's issue date may not leave its year.

**Snapshot construction**

The same function builds the snapshot itself from the booking row (joining the service name, falling back to empty when the service is gone), so a picture can never disagree with what was stored. It raises Indonesian messages for each refusal: cancelled booking, no agreed total, no DP recorded, DP above the total, due date before issue date.

**Issuing guards**

A pure guard mirrors those preconditions for the UI's disabled state and its explanation, and adds the duplicate rule: refuse when the prospective snapshot — every displayed field plus both dates' amounts — is identical to the most recent invoice for that booking. The database enforces the invariants that must never break at any cost; the duplicate rule is a UX guard that lives with the screen that has the latest invoice loaded, since there is exactly one admin and no concurrent editor.

**What the picture contains**

- Cream paper, a large italic serif wordmark, thin double rules, a right-aligned money column — a faithful reproduction of the invoice the artist already sends, at a 900×1600 logical page.
- Header: business name, the WhatsApp number from settings, the Instagram handle from settings.
- Identity block: `No:` with the invoice number, `Date:` and `Due Date:` in English month format, `To:` with the client name.
- One line item: the service name with the event type beneath it, unit price equal to the agreed total, quantity 1, total equal to the agreed total.
- Totals: SUBTOTAL, DP (the DP recorded on the booking), PELUNASAN (derived), the derived Payment Status line, and the fixed non-refundable note.
- Payment Information: bank name, account name, account number from settings (an empty setting prints an em dash rather than hiding the block).
- Format Order: event date in Indonesian format, event type, headcount, hairdo, venue, client phone, start and finish times.
- Footer: the script "Thank You".
- All amounts formatted with the existing IDR formatter, normalised to one `Rp 200.000` shape.

**Rendering and sharing**

- The layout is a pure model: given the snapshot, the business details and an injected text-measurement function, it returns an ordered list of draw operations. A thin painter executes those operations on a canvas context.
- The canvas is drawn at a 2× backing scale and exported as PNG, so WhatsApp's recompression does not blur the text.
- Two Google fonts are added through the existing font pipeline — a typewriter mono for the body and a script for the footer — and the display serif gains an italic style. Family names are resolved from the page's CSS variables at paint time and fonts are awaited before drawing, with a fallback so a failed font never blocks the invoice.
- "Bagikan" uses the Web Share API with a file when the browser supports sharing files; otherwise it downloads the PNG and offers the existing WhatsApp deep-link pattern with a new invoice message template naming the client and the invoice number.
- Nothing is uploaded and nothing is stored from the render: the image exists only in the browser.

**Invoice states and lifecycle**

- Two states only, read off `sent_at`: *belum dikirim* and *terkirim*. No void, cancel, or paid state.
- A sent invoice is frozen; an unsent one may have its two dates edited (issue date within its number's year) and may be deleted.
- A wrong invoice is answered by issuing a corrected one, which gets the next number; the old one stays as history.
- Marking sent is an explicit action with an inverse.

**Admin surface**

- The bookings dialog's rows gain an invoice action, labelled with the invoice count and the newest number and state when one exists.
- Opening it closes the bookings dialog and opens a per-booking invoice dialog — the shared dialog is single-instance and two stacked overlays would share one Escape handler. Closing the invoice dialog reopens the booking list and returns focus to the list trigger.
- The invoice dialog holds: the creation action with its refusal reason, the newest-first list with per-row sent state, the live preview of the selected invoice, the share/download actions, the sent toggle, and two-click delete.
- No tenth dashboard tab. A cross-booking invoice list is a later view over the same table.

**Booking status filter**

- A pure filter exposes an ordered vocabulary — all, pending, confirmed, cancelled — with labels reusing the booking status labels the rows already print, so a chip cannot drift from the row.
- The rows pass through the filter first, then the existing search, so a booking must match both.
- The Mendatang/Riwayat split and its paging operate on the filtered rows; both reveal counters reset whenever the chip or the search changes.
- Chips use the same roving-tablist chip pattern as the Permintaan list, with arrow/Home/End movement.
- The trigger's summary counts stay computed from all bookings, not the filtered set.

**Configuration**

- The Pengaturan section grows four fields: bank name, account name, account number, Instagram handle. Validation normalises the Instagram handle without a leading `@` and the account number to digits, and keeps the existing WhatsApp number rules untouched.
- The migration seeds the four settings columns with the details from the artist's current invoice template, so the first generated invoice is correct without further setup; they remain editable.
- Empty payment settings do not block issuing; the block prints em dashes.

## Testing Decisions

A good test asserts externally visible behaviour only: given a booking, assert the snapshot and the refusal; given a snapshot, assert the invoice number shape and the payment position; given a snapshot and business details, assert the ordered layout operations (which text appears, in what order, aligned to which margin, wrapped within the page); given a mocked Supabase client, assert the table and payload touched; given a migration file, assert the declared schema. No live database, no canvas pixels, no component internals, no snapshots.

Seams, in the order they should be preferred:

1. **Pure invoice helpers** (existing seam type): invoice-number formatting and year handling, the snapshot builder, the payment position with its status and derived remaining balance, the issuing guard including the duplicate rule, and the layout model with an injected measurement function.
2. **Adapter wrappers with an injected mock client** (existing seam type): create, list per booking, mark sent/unmark, delete.
3. **Declarative SQL verify** (existing seam type): the new migration declares the table, its columns, constraints, RLS shape, the allocation function, and the four new settings columns.
4. **Pure booking filter** (existing seam type, same shape as the Permintaan state filter): vocabulary, labels, and subset selection.
5. **WhatsApp message builder** (existing seam type): the invoice message template.

Prior art: `src/lib/__tests__/` already holds the pure-formatter, validator, adapter-with-mock-client, derived-state and SQL-verify tests this feature extends; the Permintaan filter test is the direct model for the booking filter.

The canvas painter is deliberately thin and carries no decisions worth a test: everything that could be wrong — content, ordering, alignment, wrapping, derived amounts — is in the layout model that is tested. The dialogs and chips are covered by manual QA, as with every other UI in this repo. Manual QA also covers the actual PNG output, at both a DP-accepted and a fully settled booking.

## Out of Scope

- Payment tracking of any kind: no "paid" flag, no ledger, no part-payment records, no reminders. The DP stays a single figure on the booking.
- A receipt or kwitansi document type, separate numbering for it, or retitling an invoice when it is settled.
- PDF output, printing to A4, or archiving invoices as files.
- A public invoice link, a client-facing invoice page, or any anonymous access to invoices.
- The WhatsApp Cloud API, webhooks, or automatic sending.
- Editing a sent invoice, revising it in place, or a void/cancelled state.
- Multiple line items, discounts, tax, deposits applied per line, or per-person unit pricing on the invoice.
- Changing a booking's fields from the invoice screen, or recording payments from it.
- A cross-booking invoice list, a dashboard tab for invoices, or reporting per month.
- A free-text note per invoice, or attaching the client's reference image.
- Booking filters beyond status: no date ranges, service, or event-type facets.
- Realtime updates, email, push, or notifications.

## Further Notes

- The snapshot decision — one document per change, frozen forever, many per booking — is worth an ADR (`docs/adr/0003-invoice-snapshot.md`): it is hard to reverse, surprising to a reader who expects a live view, and it trades disk and numbering noise against a client holding a stable reference.
- Glossary entries this creates: **Invoice**, **Invoice Number**, **Payment Status**, plus the caveat on **Headcount**.
- The template's language mix is intentional and preserved: English document labels (`Invoice`, `Date`, `Due Date`, `SUBTOTAL`, `PELUNASAN`, `Payment Information`, `Format Order`) with Indonesian values and an Indonesian Format Order date.
- The two fonts are the only new runtime assets. If loading them proves unreliable in the target browsers, the layout model keeps working with fallbacks and only the visual fidelity degrades.
- Suggested tickets under `.scratch/invoice-and-booking-filter/issues/`: 01 schema, allocation function and settings columns; 02 invoice number, payment position and issuing guards; 03 layout model; 04 painter, fonts and sharing; 05 invoice dialog, adapters and the booking-row entry point; 06 booking status chips; 07 settings fields and validation; 08 glossary and ADR.
- Build order follows those numbers: the data contract first, then the pure seams, then the picture, then the screen, then the filter, and documentation last.
