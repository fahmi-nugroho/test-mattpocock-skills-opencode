# Paid Invoices, multiple Services, and Bagian MUA

Status: ready-for-agent

## Problem Statement

I can issue an Invoice showing the DP, but to show that the client has paid in full I have to replace the original DP with the Agreed Total. That loses the distinction between the deposit and the final transfer. A client who paid in one transfer also has no dedicated way to get an Invoice that reflects what happened.

I can select only one Service when creating a Booking, so the Invoice leaves out other Services the client booked. When I work with collaborators, I also need to record how much I actually kept from the Booking. The amount the client paid covers the whole Booking, including the collaborators’ shares.

## Solution

Add **Catat Pelunasan** to the admin Booking workflow. Once the client pays the full outstanding balance, the admin records that amount separately from the DP. They can then issue a new numbered Invoice with a **LUNAS** stamp, Rp0 remaining, and the amounts the client paid. The paid Invoice has no due date or payment instructions. Earlier Invoices retain their saved facts and remain available to re-send.

Let the admin select several **Layanan** when creating or editing a Booking. Keep each Service name with the Booking and list all selected Services on its Invoice alongside one Agreed Total. One Service still suggests a price from its catalog price and Headcount. With multiple Services, the admin enters the Agreed Total.

Add an optional admin-only **Bagian MUA (Rp)** field for the actual amount the makeup artist kept. When recording Pelunasan, suggest the Agreed Total if Bagian MUA is blank. The admin can accept it, lower it, or clear it before saving. Keep any previously entered value, including Rp0.

## User Stories

1. As an admin, I want to select several Services when I create a Booking, so that I can record the full scope of the client’s work in one place.
2. As an admin, I want to edit the Services on an existing Booking, so that I can reflect changes agreed with the client.
3. As an admin, I want a Booking to allow an empty Service selection, so that I can save it while the details are still being agreed.
4. As an admin, I want one selected Service to suggest its catalog price multiplied by Headcount, so that straightforward Bookings stay quick to enter.
5. As an admin, I want to override the price suggestion, so that the Booking reflects the price I actually agreed with the client.
6. As an admin, I want to enter one Agreed Total for multiple Services, so that I can handle packages and Services covering different numbers of people.
7. As an admin, I want the Services already selected for a Booking to keep their names after a catalog rename or deletion, so that I can still issue an accurate Invoice later.
8. As an admin, I want to record the full outstanding balance as Pelunasan, so that the original DP remains visible.
9. As an admin, I want to record Pelunasan when the client paid the entire price in one transfer, so that I can issue an accurate paid Invoice with DP Rp0.
10. As an admin, I want the outstanding amount shown before I record Pelunasan, so that I can check it against the amount received.
11. As an admin, I want a saved Pelunasan to reduce the Booking balance to zero, so that the Booking and a newly issued Invoice agree.
12. As an admin, I want repeated settlement attempts to leave a single Pelunasan, so that a retry cannot double-count the client’s money.
13. As an admin, I want to explicitly undo an incorrect Pelunasan, so that I can fix a payment entry and record it correctly.
14. As an admin, I want a settled Booking to require undoing Pelunasan before I can change the Agreed Total or DP, so that those edits cannot silently change a recorded payment.
15. As an admin, I want to choose when to issue the next Invoice after a payment, so that recording money and creating a client document remain separate actions.
16. As an admin, I want to create a paid Invoice without supplying a due date, so that I can issue a document that reflects a settled Booking.
17. As an admin, I want to find, download, and re-send earlier Invoices, so that I can give the client the same amounts, dates, and Service names they received before.
18. As an admin, I want the existing duplicate check to recognize an identical Invoice, so that re-sending it does not consume another Invoice Number.
19. As a client, I want every Service listed on my Invoice, so that I can check what the Booking covers.
20. As a client, I want one Agreed Total alongside the Service names and Booking Headcount, so that I can see what the whole Booking costs.
21. As a client who has paid a DP, I want the DP and outstanding balance shown with a due date and payment instructions, so that I know how much to pay and by when.
22. As a client who has paid in full, I want a clear **LUNAS** stamp and Rp0 remaining, so that I can see the Booking is settled at a glance.
23. As a client who paid in two transfers, I want the original DP and Pelunasan both shown, so that I can reconcile the Invoice with those transfers.
24. As a client who paid in one transfer, I want the full amount shown as Pelunasan, so that the Invoice accurately describes my payment.
25. As a client whose Booking is settled, I want a paid Invoice free of due dates and payment instructions, so that I am not prompted to pay again.
26. As a client, I want all Service names to remain readable on the shared Invoice even when the list is long, so that I can verify the Booking from my phone.
27. As an admin, I want to enter or edit the actual Bagian MUA on a Booking, so that I can record what I kept after collaborators received their shares.
28. As an admin, I want blank Bagian MUA and Rp0 to carry different meanings, so that I can distinguish an unknown amount from a confirmed zero.
29. As an admin, I want blank Bagian MUA to default to the Agreed Total when recording Pelunasan, so that solo Bookings take less typing.
30. As an admin, I want to lower or clear that suggestion before saving, so that the recorded amount reflects what I kept or remains unknown.
31. As an admin, I want a previously entered Bagian MUA, including Rp0, to survive settlement, so that a suggestion cannot replace a figure I already recorded.
32. As an admin, I want Bagian MUA constrained to the Agreed Total or less, so that I can catch a mistyped amount.
33. As the makeup artist, I want Bagian MUA visible only to the admin, so that the client’s Invoice and shared calendar never expose my portion of the Booking.

## Implementation Decisions

### Booking Services and pricing

- The **Layanan** picker supports multiple optional selections in both admin Booking forms, including the admin form reached from a Booking Request. Each selected Service appears once. The client’s Format Booking continues to collect request details without pricing or Service selection.
- A Booking retains the selected Service names at selection time. Renaming or deleting a catalog Service leaves those names available when the admin edits the Booking or issues another Invoice. The admin can change the Services by updating the Booking’s selections.
- Carry forward any existing Booking’s linked single Service and its available name. Bookings whose Service link was previously lost remain readable with an empty selection.
- Use the existing catalog price multiplied by Headcount as the overridable suggestion for one Service. With multiple Services, save an Agreed Total entered by the admin. Headcount still describes the whole Booking. Keep one Agreed Total on the Invoice, without calculating or displaying per-Service amounts.
- Update existing consumers that display Booking Services to use the saved names. The Booking list and search recognize all selected Services. The Calendar Mirror keeps projecting confirmed Bookings using those names wherever it already describes the Service.

### Pelunasan and Bagian MUA

- Save Pelunasan as its own amount. The **Catat Pelunasan** action confirms and records the full outstanding balance on the saved Booking. It requires a known Agreed Total and a positive outstanding balance. DP can be zero. The amount and its eligibility come from the persisted Booking at the time of the write. A stale or repeated action must not record a different transfer or count settlement twice.
- Derive the balance from Agreed Total minus DP and Pelunasan. A Booking with an existing DP equal to its Agreed Total is already settled. Preserve the recorded DP and leave Pelunasan empty when the actual deposit and final payment cannot be recovered from older data.
- Provide an explicit undo for recorded Pelunasan. Require undo before editing Agreed Total or DP on a Booking with recorded Pelunasan. Undo affects the current Booking’s payment position. Previously issued Invoices retain their snapshots.
- Bagian MUA is an optional amount in whole rupiah. Blank means unknown. Zero is valid. A known value requires an Agreed Total and must fall between zero and that total. Validate these rules when either amount changes.
- In the settlement form, suggest the Agreed Total only when Bagian MUA is blank. The admin can clear the suggestion and save a blank. Preserve any existing amount unless the admin explicitly changes it. Save the final transfer and the amount reviewed in the same settlement action, so a failed write cannot partially record the action. Changing or undoing Pelunasan does not itself change Bagian MUA.
- Keep Bagian MUA within authenticated admin Booking data. The amount never enters Invoice snapshots, exported images, the Calendar Mirror, or public responses. Client payment calculations use only Agreed Total, DP, and Pelunasan.

### Invoice issue and rendering

- Continue to issue a dated, numbered snapshot using the existing Invoice Number series. Copy the Booking’s saved Service names, Agreed Total, DP, and Pelunasan atomically at issue. Include the Service names and Pelunasan in duplicate comparison. A private Bagian MUA edit cannot make an otherwise identical Invoice different.
- Invoice eligibility requires a recorded client payment and the existing applicable Booking and issue-date checks. A positive Pelunasan with DP Rp0 qualifies. An outstanding Invoice with a recorded DP keeps its existing due-date validation and payment instructions.
- Derive `Lunas` from the Invoice’s saved client payments covering the Agreed Total. Newly issued `Lunas` Invoices have no due date. Preview and export show the same **LUNAS** stamp, Rp0 remaining, and payment details, with no due date or payment instructions. Show the original DP and the Pelunasan amount when recorded, including the Rp0 DP on a one-transfer Invoice.
- Render all saved Service names in the existing Invoice visual style. Allow the document to grow for a long list, so every Service and the remainder of the Invoice stays legible.
- Read legacy snapshots with their original Service name, amounts, dates, and derived Payment Status. If an earlier paid Invoice has a saved due date, display it when re-rendered. Keep the existing lifecycle for preview, download, share, sent marking, and allowed date corrections. A new paid Invoice’s date controls reflect that it has only an issue date.

## Testing Decisions

- Use the existing tests around admin Booking and Invoice operations for write behavior and the existing Invoice layout tests for client-visible content. Test persisted or returned outcomes through those boundaries. Prefer assertions about what the admin can do and what the client sees over private helper calls or exact drawing coordinates.
- Extend the admin Booking CRUD and validation tests for creating and editing with several Services, preserving a manually entered Agreed Total, handling saved names after catalog changes, reading a legacy single Service, and enforcing the Bagian MUA amount rules. Check the price suggestion and the settlement form’s Bagian MUA default, override, and clear behavior in the existing admin forms.
- Extend admin Booking and Invoice operation tests and the existing SQL contract tests for settlement with and without a DP, the paid versus unpaid issue rules, persistence of actual payment amounts, repeated or stale settlement attempts, undo and correction, admin-only data access, and preservation of earlier snapshots. Include existing adapter error-propagation patterns so failed operations are visible to the admin.
- Extend the Invoice issue/refusal and duplicate tests for the full Service list, separate Pelunasan, optional paid due date, and legacy compatibility. Confirm that editing Bagian MUA alone does not change Invoice issue decisions or payloads.
- Extend the Invoice layout tests that inspect rendered text and draw commands. Cover all Service names, one Agreed Total, separate DP and Pelunasan, the **LUNAS** stamp, Rp0 remaining, and the paid versus outstanding date and payment sections. Include a long Service list, a one-transfer payment, a legacy paid Invoice with a due date, and the absence of Bagian MUA on every Invoice.
- Use the existing Calendar Mirror projection and public contract tests to verify that the projected Service description still works and that Bagian MUA remains private. The project’s existing Vitest suite is the agreed test setup for this work.

## Out of Scope

- Installment schedules or a payment ledger beyond the DP and single Pelunasan.
- Per-Service pricing or Headcount, collaborator accounts, payout tracking, and earnings reports.
- New public Format Booking fields, client self-service, payment gateways, or automatic sending of paid Invoices.
- A second Invoice type or Invoice Number series.
- Reconstruction of historical deposit splits or previously deleted Service names where the source records no longer exist.

## Further Notes

- The terms are defined in the [Glossary](../../GLOSSARY.md). [ADR-0003](../../docs/adr/0003-invoice-snapshot.md) establishes the frozen, numbered Invoice model. [ADR-0005](../../docs/adr/0005-preserve-booking-payment-and-service-details.md) extends it with Pelunasan and the selected Service names.
- Example with a DP. An Agreed Total of Rp1.500.000 and a DP of Rp500.000 yields Pelunasan of Rp1.000.000. The new Invoice shows both payments and Rp0 remaining. If the collaborator received Rp600.000, the admin can change the suggested Bagian MUA from Rp1.500.000 to Rp900.000.
- Example without a DP. A transfer of Rp1.500.000 against an Agreed Total of Rp1.500.000 yields DP Rp0 and Pelunasan Rp1.500.000. The admin can issue a **LUNAS** Invoice after recording the transfer.
