# Spec: Improve the Invoice picture

Status: ready-for-agent

## Problem Statement

As the makeup artist, the Invoice picture I send to a client reads like a half-translated template rather than a document written for her. Its labels are in English (`Date`, `Due Date`, `To`, `Hairdo`, `Venue`) while the figures and status are in Indonesian (`PELUNASAN`, `Lunas`, `DP diterima`, `orang`), and the issue and due dates are in English while the Event Date is in Indonesian. The item row prints `QTY 1`, a `PRICE` and a `TOTAL` that are all the same number, and says nothing about the Headcount, which is buried further down the page. The amount the client still has to pay is the same size as every other row, so the one fact she needs is easy to miss. The smallest text (12–14 px on a 900 px page) is the first thing to turn to mush when WhatsApp recompresses the image. The bank details and the "down payment is non-refundable" note print even on an Invoice that is already `Lunas`, where they mean nothing. And the page is a fixed 1600 px tall, so a long venue or client name wraps and can push the footer off the bottom edge.

## Solution

The Invoice picture keeps its current identity — cream paper, typewriter body, italic wordmark, gold script thank-you — so a returning client still recognises it, but it is rewritten for an Indonesian client and made easy to read at a glance.

Every label and date on the page is Indonesian. The item row shows the item, the Headcount and one agreed total instead of a repeated QTY/PRICE/TOTAL. The money block has one clear focal point: the remaining balance, in a larger gold figure, next to a badge showing the Payment Status. Payment instructions follow the Payment Status: while money is owed (`DP diterima`) the Invoice shows the bank details, a "please settle before the due date" prompt and the non-refundable note; once the Invoice is `Lunas` it drops all three and confirms payment instead. No text is smaller than 16 px. The page is at least 1600 px tall and grows only when the content needs more, so nothing is ever clipped.

Nothing about issuing, previewing, sharing or storing an Invoice changes. The picture is still drawn in the admin's browser from the saved snapshot, so every existing Invoice, including ones already sent, is simply drawn in the new layout the next time it is previewed, downloaded or shared. Its content — number, dates, amounts, Payment Status — is exactly what the client was told.

## User Stories

**The client reading an Invoice**

1. As a client, I want every label on the Invoice in Indonesian, so that I can read it without translating.
2. As a client, I want the issue date and due date written in Indonesian (for example `21 Oktober 2026`), so that all the dates on the page look the same.
3. As a client, I want the Event Date to keep its weekday (for example `Sabtu, 14 November 2026`), so that I can check at a glance that the artist has the right day.
4. As a client, I want the item row to show my Headcount, so that I can see how many people the total covers.
5. As a client, I want a single agreed total on the item row instead of the same figure three times, so that I am not left wondering whether I am being charged more than once.
6. As a client, I want the agreed total to be the figure I agreed to, so that it is never a recalculated price × Headcount that differs from what I was quoted.
7. As a client, I want the amount I still have to pay to be the largest figure in the money block, so that I know what to transfer without searching.
8. As a client, I want a clearly visible badge saying whether the booking is `DP diterima` or `Lunas`, so that I know where I stand without doing arithmetic.
9. As a client, I want the badge and the remaining balance to always agree, so that the page never contradicts itself.
10. As a client with an outstanding balance, I want the bank, account name and account number on the Invoice, so that I can pay from the same message.
11. As a client with an outstanding balance, I want a line asking me to settle before my due date, with that date, so that I know when the money is expected.
12. As a client with an outstanding balance, I want to be told that the DP is non-refundable, in Indonesian, so that there is no misunderstanding later.
13. As a client whose booking is settled, I want the Invoice to confirm that payment is complete, so that I know there is nothing more to do.
14. As a client whose booking is settled, I want the bank details and the "please settle" prompt gone, so that I am not tempted to pay twice.
15. As a client, I want all text to be big enough to read on a phone without zooming, so that I can check the Invoice in the chat.
16. As a client, I want the Invoice to stay legible after WhatsApp recompresses the picture, so that I can still read the amounts.
17. As a client, I want a long venue or name to wrap rather than run off the edge, so that nothing I need is cut off.
18. As a client, I want the footer and thank-you to always be fully visible, so that the page never looks truncated.
19. As a client, I want the Invoice to look like the one I got before — same paper, wordmark and typewriter face — so that nothing about the transaction feels unfamiliar.
20. As a client, I want the Invoice to contain only my own booking, so that I never see anyone else's details.

**The admin issuing and re-sending Invoices**

21. As an admin, I want the improved layout with no change to how I issue, preview, share, download or mark an Invoice sent, so that I do not have to relearn anything.
22. As an admin, I want an old Invoice I re-download to use the new layout, so that I never hand a client a mix of old and new looks.
23. As an admin, I want an old Invoice's number, dates, amounts and Payment Status to stay exactly as issued, so that a re-sent copy still matches what the client was told.
24. As an admin, I want a short Invoice to remain exactly 900×1600, so that sizing in the chat is the same as before.
25. As an admin, I want a long Invoice to be taller rather than cropped, so that I never have to shorten the venue to make it fit.
26. As an admin, I want an empty setting (WhatsApp, Instagram, bank details) to print an em dash instead of removing its block, so that a missing setting is visible rather than silent.
27. As an admin, I want a `DP diterima` Invoice to keep printing the bank block even when the bank settings are empty, as em dashes, so that I notice and fix the settings before sending.
28. As an admin, I want the preview to be the exact picture that gets shared or downloaded, so that what I check is what I send.
29. As an admin, I want the font fallback to keep working, so that a font that fails to load never blocks an Invoice.

**The business owner**

30. As the business owner, I want the Payment Status to stay derived from the Invoice's own copied amounts and never stored or set by hand, so that the badge can never be wrong.
31. As the business owner, I want no schema change and no new stored data, so that this cannot affect existing Invoices or Bookings.
32. As the business owner, I want the frozen snapshot, one-series numbering and sent-state rules left untouched, so that the record of what each client was told stays intact.

## Implementation Decisions

**Behaviour (the picture)**

- Language: every printed label and date is Indonesian. Fixed English words go: the identity block (`Date`, `Due Date`, `To`), the Payment Information and Format Order headings and labels, the Event/Style/Venue/Phone/time labels and the thank-you. `INVOICE`, `DP` and `Lunas` are kept as-is. Suggested wording: `Tanggal`, `Jatuh Tempo`, `Kepada`, `Jenis Acara`, `Jumlah Orang`, `Gaya Rambut`, `Jam Mulai`, `Jam Selesai`, `Terima kasih`.
- Dates: the issue and due dates are written in Indonesian long form without a weekday; the Event Date keeps its weekday.
- Item row: columns become item, Headcount and one total. The unit-price and quantity columns are removed. The row shows the Headcount as `N orang` and the agreed total, never price × Headcount, in line with the Headcount entry in the glossary. The event type stays beneath the item name.
- Money block: shows the agreed total, the DP and the remaining balance. The remaining balance is the visual focal point: larger, gold, and labelled `SISA PEMBAYARAN`. A badge beside or beneath it shows the derived Payment Status in capitals (`LUNAS` / `DP DITERIMA`). The badge is drawn from the same Payment Status the page already derives; the stored value, glossary value and derivation do not change.
- Payment instructions depend on Payment Status:
  - `DP diterima`: print the Payment Information block (bank, account name, account number, em dash for any empty value), a prompt of the form "Mohon lunasi sebelum {Jatuh Tempo}", and the note `DP tidak dapat dikembalikan.`.
  - `Lunas`: omit the Payment Information block, the prompt and the refund note, and instead print a payment-complete confirmation.
- Legibility: no text is drawn smaller than 16 px. Every size, spacing and wrapping width that depends on the old smaller sizes is re-flowed to match.
- Page size: the width stays 900 and the margin 72, and the backing scale stays 2×. The height is at least 1600 and grows to fit the content plus the thank-you footer. The page height is reported by the layout itself rather than fixed in the painter, so a taller page is both measured and painted at the same size.
- Identity is kept: cream paper, typewriter body face, italic display wordmark, gold script thank-you and the existing colours. No logo or new asset is added.

**Modules**

- The pure Invoice layout module changes: new labels and wording, the item row, the money block, the conditional payment section, the minimum text size and the content-driven page height. It remains the only place that decides what is drawn and where.
- The canvas painter changes minimally: it sizes the canvas from the height the layout reports instead of a constant. It still makes no content or layout decisions.
- The date formatting helpers gain an Indonesian long date without weekday for the issue and due dates; the existing helpers are otherwise untouched.
- The page-size constant keeps width and margin; its fixed height becomes a minimum height.
- The Invoice preview, dialog, share adapter, snapshot, numbering, lifecycle, Booking list and everything under `supabase/` are not touched.

**Domain and decisions**

- Existing glossary terms are used unchanged: Invoice, Invoice Number, Payment Status, Headcount, Style. No new term is needed and no glossary edit is required.
- ADR-0003 is not contradicted: the Invoice remains a frozen snapshot and the PNG remains a derivative drawn from it. Drawing old Invoices in a new layout is exactly what that ADR's "the PNG is a derivative" consequence allows. No new ADR is needed because the change is easy to reverse.
- Spec stories 5 and 6 of the earlier "Invoices and Booking Status Filters" spec (bank details and the non-refundable note on every Invoice) are narrowed by this spec: they now apply while the Invoice is `DP diterima`. The earlier spec is left as a historical record.

## Testing Decisions

- A good test here checks what the picture contains and where, as reported by the draw list, and never how the layout code arrives at it. It does not depend on font metrics, pixels or canvas behaviour.
- The one seam is the existing pure layout seam: a saved Invoice snapshot plus the business details plus an injected text-measurement function in, an ordered draw list out. This is the highest seam, already exists, and covers every changed behaviour. No new seam is introduced.
- Cases to cover through that seam:
  - Every label and date printed is Indonesian; no leftover English label remains; the issue and due dates are in the Indonesian long form without weekday and the Event Date still has its weekday.
  - The item row shows the Headcount and one total; no quantity or unit-price column; the printed total is the agreed total, not price × Headcount.
  - The remaining balance and the Payment Status badge appear, are consistent with each other, and the balance is drawn larger than the other money rows.
  - A `DP diterima` Invoice prints the bank block, the settle-before prompt with the due date and the non-refundable note; empty bank settings print em dashes.
  - A `Lunas` Invoice prints the payment-complete confirmation and none of the bank block, the prompt or the refund note.
  - No text op is smaller than 16 px.
  - A short Invoice reports a page 900×1600; an Invoice with long wrapped content reports a taller page, every mark lies inside it, and the thank-you is below all other content.
  - Marks stay inside the page margins at the reported size, for the existing long-name and em-dash cases.
- Prior art: the existing pure layout test for the Invoice, which already drives wrapping with a fake measurement function and asserts content, order, margins and em-dash fallback. Its page-size, QTY/PRICE, English-label and always-print-bank assertions are replaced by the cases above. The sharing, numbering, schema and share-message tests are unaffected and must stay green.
- The canvas painter and font loading stay untested, as today; they are thin and own no decisions.

## Out of Scope

- Any change to how an Invoice is issued, previewed, shared, downloaded, deleted or marked sent.
- A PDF or any format other than PNG.
- A logo, new fonts, a new colour palette or a redesign of the identity.
- An English version or a language switch.
- Changing the attachment file name, the share title or the WhatsApp message.
- Any database, migration, settings or Booking change; stored PNGs or a layout-version column.
- Changing the Invoice Number series, the snapshot columns, the Payment Status rule or the duplicate guard.
- Changing the preview card size or the Invoice list in the dialog.

## Further Notes

- Terminology: the glossary calls it Style (Hijabdo or Hairdo) and lists "Model rambut" and "hairstyle" as terms to avoid. The suggested printed label `Gaya Rambut` is close to "hairstyle". The spec keeps the domain term Style and leaves the printed label to the implementer: `Gaya Rambut` is agreed in discussion, but a shorter `Gaya` avoids the glossary's concern if the admin prefers it.
- The Style value stored on the snapshot is still printed through the existing label mapping (`Hijabdo` / `Hairdo`).
- Because old Invoices are drawn in the new layout, a sent Invoice that is re-downloaded will look different from the picture the client actually received. Its content is identical, so this is accepted; it is the documented consequence of storing the snapshot rather than the PNG.
- A `Lunas` Invoice no longer carries the bank details. If that turns out to be wrong in practice, restoring them on `Lunas` is a one-section change.
