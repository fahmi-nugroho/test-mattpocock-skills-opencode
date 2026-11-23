# 01: Record Pelunasan and issue a LUNAS Invoice

**What to build:** The admin can record a client’s full outstanding balance through **Catat Pelunasan** and choose when to issue a new numbered **LUNAS** Invoice. The Booking and Invoice show the original DP, the final transfer, and Rp0 remaining.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] **Catat Pelunasan** shows the outstanding amount for a saved Booking with a known Agreed Total and positive balance. It records that amount separately and keeps the DP intact. With an Agreed Total of Rp1.500.000 and a DP of Rp500.000, it records Rp1.000.000 as Pelunasan.
- [ ] A client who pays Rp1.500.000 in one transfer can receive a paid Invoice showing DP Rp0 and Pelunasan Rp1.500.000. Invoice eligibility still requires a recorded payment and the applicable Booking and issue-date checks.
- [ ] A repeated settlement creates no second payment. If the saved Booking has changed since the admin reviewed the amount, the admin must review the new amount before recording a transfer. Agreed Total and DP edits are refused while recorded Pelunasan is present.
- [ ] Payment Status and remaining balance use the recorded client payments. Issuing is a separate action in the existing Invoice Number series. The duplicate check includes Pelunasan. A legacy Booking with DP equal to its Agreed Total can still receive a paid Invoice using its recorded DP.
- [ ] The new paid Invoice shows **LUNAS**, Rp0 remaining, and the recorded payments in the preview and exported image. It has only an issue date. An outstanding Invoice still shows the due date and payment instructions.
- [ ] Earlier Invoices remain available to preview, download, and share with their saved payments, dates, and status. An older paid Invoice still displays its saved due date. Sent marking and applicable date corrections continue to work.
- [ ] Existing admin operation, Invoice issue, SQL contract, and Invoice layout tests cover settlement with and without a DP, stale or repeated attempts, and the paid, outstanding, and legacy Invoice cases.
