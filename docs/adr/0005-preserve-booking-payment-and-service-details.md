# Preserve payment and Service details from Booking to Invoice

Status: accepted

Previously, recording a full payment meant replacing the original DP, and a
catalog rename or deletion could change the Service shown on a later Invoice.
The Booking now records the actual Pelunasan separately and keeps the names of
its selected Services. A new Invoice snapshots those facts so it can show what
the client booked, deposited, and later paid. This extends the numbered snapshot
model from [ADR-0003](0003-invoice-snapshot.md).

The admin records Pelunasan for the full outstanding balance, including when
there was no DP. Correcting the Agreed Total or DP on a settled Booking requires
explicitly undoing Pelunasan first, so a price correction cannot silently change
the recorded transfer. New `Lunas` Invoices show the stamp and zero balance and
omit the due date and payment instructions.

Existing Invoices keep the payment amounts, Service names, and due dates saved
when they were issued. Old records that used the DP field for a full payment
cannot reveal how much was originally paid as a deposit. Bagian MUA is private
Booking information and is excluded from the client Invoice. When recording
Pelunasan, the form suggests the Agreed Total if Bagian MUA is blank. The admin
can accept, change, or clear the suggestion before saving. A previously entered
amount, including zero, stays in place.
