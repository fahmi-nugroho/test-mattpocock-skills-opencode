# 08: Record the Invoice vocabulary and the snapshot decision

**What to build:** The project's language and decision record catch up with the feature. GLOSSARY.md defines Invoice, Invoice Number and Payment Status, and adds the Headcount caveat that an Invoice prints the agreed total rather than price × headcount; it uses no Bill, Receipt, Kwitansi or Tagihan synonym. A new ADR records the frozen-snapshot choice — many Invoices per Booking, each never rewritten — with its consequences (duplicate numbers, numbering noise, the re-send path) and why it is hard to reverse, so a future reader does not "fix" it into a live view.

**Blocked by:** 02, 03, 04.

**Status:** resolved

- [x] GLOSSARY.md defines Invoice, Invoice Number and Payment Status in the project's existing format.
- [x] The Headcount entry gains the caveat that the Invoice prints the agreed total, not price × headcount.
- [x] No Bill, Receipt, Kwitansi or Tagihan synonym is introduced anywhere.
- [x] The ADR records the snapshot decision, its context, its consequences and the alternatives rejected.
- [x] The documentation's names and behaviour match what ships.

## Comments

- 2026-10-21 — Resolved on `feat/invoice-and-booking-filter-spec`.
  - `GLOSSARY.md` gains **Invoice**, **Invoice Number** and **Payment Status** in the existing bold-term / definition / `_Avoid_` format. Invoice is the dated, numbered frozen record of a Booking at issue, with many kept per Booking; Invoice Number is the number drawn from the one `invc-NN/YYYY` series, restarting each January from the issue date; Payment Status is the derived `Lunas` / `DP diterima` position. The Invoice `_Avoid_` line names the document synonyms, so no alternative term is defined or used.
  - **Headcount** now ends with the caveat that an Invoice prints the agreed total, not price × headcount. This matches the shipped layout, which renders quantity `1` with `subtotal` as price and total.
  - Added `docs/adr/0003-invoice-snapshot.md`: context (retyped pictures, multiple copies, drift, lost history), the decision (frozen snapshot rows, many per Booking, the single numbered series, the `invoices_guard_lifecycle` freeze, screen-side duplicate refusal, old copies re-sendable), four rejected alternatives (live view, draft-until-sent, PNG-only, revision history), and consequences covering duplicate-number avoidance, numbering noise, the re-send path and why reverting to a live view is unrecoverable.
  - No code or schema changed; the docs were checked against `0018`, `0019`, `invoice.ts` and `invoice-layout.ts`. `npm run typecheck` clean; full `vitest run` 590 passed across 62 suites.
