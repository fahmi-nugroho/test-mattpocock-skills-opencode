# 02: Issue and list Invoices from a Booking

**What to build:** From a Booking row the admin opens that Booking's invoices, sees how many exist and which one is newest, and issues one in a single action without retyping anything. Issuing defaults the issue date to today and the due date to the Booking date, saves the snapshot through the allocation function, and either returns the new Invoice or shows the plain Indonesian reason it was refused — cancelled Booking, no agreed total, no DP recorded, DP above the total, due date before the issue date, or a prospective Invoice identical to the newest one (in which case the admin is told to resend the existing one instead of minting a duplicate number). The dialog lists every Invoice for that Booking newest first with its number, issue and due dates, DP, remaining balance, Payment Status and sent state. Opening the dialog closes the booking list; closing it reopens the booking list with focus back on its trigger. Editing the Booking after issue never changes a saved Invoice.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] Invoice number formatting and year handling are pure and tested: one `invc-NN/YYYY` series, sequence restarting each January, and the year read from the issue date.
- [ ] Payment position is pure and tested: remaining balance is always subtotal minus DP; Payment Status is `Lunas` when the DP is at least the subtotal, otherwise `DP diterima`.
- [ ] The issuing guard is pure and tested: it refuses a cancelled Booking, no agreed total, no DP, a due date before the issue date, and a snapshot identical to the newest Invoice for the Booking, each with an Indonesian reason the dialog can show.
- [ ] Create and list-newest-first go through adapters that touch the invoices table, verified with a mocked client.
- [ ] The booking row shows the Invoice count and the newest number and sent state; with none it offers the plain issue action.
- [ ] The invoice dialog offers creation with defaults (issue today, due on the Booking date), displays the refusal reason inline, and never issues a duplicate.
- [ ] The list shows number, dates, DP, remaining balance, Payment Status and sent state, newest first, and selects an Invoice for the later preview.
- [ ] Editing the Booking after issue leaves the saved Invoice's snapshot unchanged.
- [ ] Opening the invoice dialog closes the booking list; closing it reopens the booking list and returns focus to the list trigger.
