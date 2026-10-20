# 02: Issue and list Invoices from a Booking

**What to build:** From a Booking row the admin opens that Booking's invoices, sees how many exist and which one is newest, and issues one in a single action without retyping anything. Issuing defaults the issue date to today and the due date to the Booking date, saves the snapshot through the allocation function, and either returns the new Invoice or shows the plain Indonesian reason it was refused — cancelled Booking, no agreed total, no DP recorded, DP above the total, due date before the issue date, or a prospective Invoice identical to the newest one (in which case the admin is told to resend the existing one instead of minting a duplicate number). The dialog lists every Invoice for that Booking newest first with its number, issue and due dates, DP, remaining balance, Payment Status and sent state. Opening the dialog closes the booking list; closing it reopens the booking list with focus back on its trigger. Editing the Booking after issue never changes a saved Invoice.

**Blocked by:** 01.

**Status:** resolved

- [x] Invoice number formatting and year handling are pure and tested: one `invc-NN/YYYY` series, sequence restarting each January, and the year read from the issue date.
- [x] Payment position is pure and tested: remaining balance is always subtotal minus DP; Payment Status is `Lunas` when the DP is at least the subtotal, otherwise `DP diterima`.
- [x] The issuing guard is pure and tested: it refuses a cancelled Booking, no agreed total, no DP, a due date before the issue date, and a snapshot identical to the newest Invoice for the Booking, each with an Indonesian reason the dialog can show.
- [x] Create and list-newest-first go through adapters that touch the invoices table, verified with a mocked client.
- [x] The booking row shows the Invoice count and the newest number and sent state; with none it offers the plain issue action.
- [x] The invoice dialog offers creation with defaults (issue today, due on the Booking date), displays the refusal reason inline, and never issues a duplicate.
- [x] The list shows number, dates, DP, remaining balance, Payment Status and sent state, newest first, and selects an Invoice for the later preview.
- [x] Editing the Booking after issue leaves the saved Invoice's snapshot unchanged.
- [x] Opening the invoice dialog closes the booking list; closing it reopens the booking list and returns focus to the list trigger.

## Comments

- 2026-10-20 — Resolved on `feat/invoice-and-booking-filter-spec`.
  - Added `src/lib/admin/invoice.ts`: `formatInvoiceNumber`/`invoiceYear` (the number's year always comes from the issue date, so the series restarts each January), `paymentPosition` (balance = subtotal − DP; `Lunas` at DP ≥ subtotal), the prospective snapshot, newest-first grouping/sorting, the sent-state vocabulary, and the pure issuing guard. The guard refuses a cancelled Booking, a null total, no DP, DP above the total, a due date before the issue date, and a snapshot identical to the newest Invoice — that last one names the existing number and tells the admin to resend it.
  - Added `src/lib/supabase/admin-invoices.ts`: `createInvoice` calls the `create_invoice` allocation function and passes its Indonesian refusals through unchanged; `listInvoicesAdmin` reads the `invoices` table newest first and narrows to one Booking when given an id.
  - Added the `Invoice`/`Invoice` RPC types and the four payment-settings fields to `database.ts` (surface 0018 already created).
  - Bookings manager loads invoices with the bookings, groups them newest first, shows each row's count + newest number + sent state (or plain "Buat invoice"), closes the booking list before opening `InvoiceDialog`, and reopens it with focus on the row's invoice action when the dialog closes. The dialog defaults issue date to today and due date to the Booking date, shows the guard's refusal inline, disables creation while refused, and lists every Invoice newest first with number, dates, DP, balance, Payment Status and sent state; selecting one is kept for ticket 04's preview.
  - Editing a Booking only changes `items`; every rendered invoice fact comes from the saved `Invoice` row, and the frozen-snapshot test pins that distinction.
  - Tests: `invoice.test.ts` (21 pure cases) and `admin-invoices.test.ts` (5 adapter cases with a mocked client). `npm run typecheck` clean; full `vitest run` 529 passed.
  - Code review (standards + spec axes). Fixed: shared the service-name lookup, removed the dialog's redundant re-sort, made one `invoiceIsSent` rule drive both label and badge, collapsed the duplicate snapshot row mapper, and folded the per-booking list into the same `listInvoicesAdmin` adapter so the tested path is the production path. Deliberately unchanged: the manager fetches all invoices once because booking-row counts need them, and "focus back on the list trigger" is implemented as focus on the row's invoice action inside the reopened booking list (the trigger that opened the invoice dialog), not the now-covered list button.
  - Noted ADR conflict: ADR-0001's sentence that the `Settings` type carries `wa_number` only is already superseded by later settings work and by the invoice spec's four payment columns; no ADR-0001 behaviour is revived.
