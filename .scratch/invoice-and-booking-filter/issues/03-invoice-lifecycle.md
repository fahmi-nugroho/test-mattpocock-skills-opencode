# 03: Correct, send and delete an Invoice

**What to build:** An Invoice the admin has issued can be managed without ever rewriting what a client already received. An unsent Invoice can have its issue and due dates corrected, but the issue date may not leave the year encoded in its number; a sent Invoice offers no date edit. Marking an Invoice sent, and unmarking it again, is an explicit action that never happens automatically — sharing an image does not claim delivery. A mistaken Invoice can be deleted behind a two-click confirmation, and an unsent newest Invoice's number becomes available to the next issue instead of leaving a skip. A sent Invoice stays exactly as recorded.

**Blocked by:** 02.

**Status:** resolved

- [x] Mark sent and unmark go through an adapter that writes and clears the sent timestamp, verified with a mocked client.
- [x] The sent state shown in the list and on the booking row updates after either action without a page reload.
- [x] An unsent Invoice's two dates can be edited through an adapter; the issue date cannot leave its number's year, and `due_on >= issued_on` still holds.
- [x] A sent Invoice exposes no date editing.
- [x] Delete is behind a two-click confirmation and goes through an adapter; the list and the booking-row count update at once.
- [x] The next number is always highest + 1, so deleting the newest unsent Invoice reuses its number rather than skipping it.
- [x] A sent Invoice remains as history when a corrected Invoice is issued; the series advances rather than rewriting the old row.

## Comments

- 2026-10-20 — Resolved on `feat/invoice-and-booking-filter-spec`.
  - Added `setInvoiceSent`, `updateInvoiceDates` and `deleteInvoice` to `src/lib/supabase/admin-invoices.ts`. Marking writes `sent_at` and unmarking clears it; dates write only `issued_on`/`due_on`; delete removes by id. All three are tested with a mocked client.
  - Added the pure `invoiceDateEditRefusal` guard: a sent Invoice is locked, an unsent Issue date must stay inside the number's year, and the due date may not precede the issue date. `invoiceIssueRefusal` now shares the one date-order rule. The dialog's date inputs also pin the issue date to the number's year and the due date to the issue date.
  - `InvoiceDialog` gained the explicit sent toggle, the unsent-only date correction, and the two-click delete. `BookingsManager` replaces or removes the returned row in its loaded Invoice list, so both the dialog list and the Booking row's count/newest number/sent state update without a reload. A sent Invoice renders no date editor and no delete action.
  - Added `0019_invoice_lifecycle.sql`: a trigger freezes every field except `sent_at` once sent, so correcting a delivered Invoice means issuing the next number. A direct delete of a sent Invoice is refused; the Booking's `on delete cascade` still passes (verified against a local Postgres that the FK cascade reaches the trigger at depth 2). Deleting an unsent newest Invoice still frees its number because `create_invoice` allocates `max(seq) + 1` (0018, already covered by `invoice-schema.test.ts`).
  - Tests: `invoice.test.ts` (25 pure cases), `admin-invoices.test.ts` (12 adapter cases), `invoice-schema.test.ts` (15 declarative cases). `npm run typecheck` clean; full `vitest run` 543 passed across 58 suites.
  - Code review (standards + spec axes). Fixed: the delete trigger no longer blocks deleting a Booking that has a sent Invoice; the freeze copy now points at issuing a new Invoice rather than inviting a rewrite; the adapter date test now exercises a real year refusal; lifecycle actions share one busy/error runner and reset path; the duplicated date type and date-order message are shared; `onDeleted` passes the id it actually needs. Deliberately unchanged: unmarking still re-enables correction, since `sent_at` is the only state and unmark exists for a mark made by mistake (a delivered Invoice stays locked until that explicit action).
