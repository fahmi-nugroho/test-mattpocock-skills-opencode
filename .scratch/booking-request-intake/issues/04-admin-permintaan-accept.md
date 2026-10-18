# 04: Admin Permintaan section, link generation, and accept-into-booking

**Spec:** [booking-request-intake/spec.md](../spec.md)

**What to build:** The admin half: a "Permintaan" section listing requests, generating a Format Booking link, and turning a submitted request into a booking through the existing create form — plus the new booking fields on that form.

**Blocked by:** 03 (the form the link points at must exist before a link is useful).

**Status:** needs-triage

- [ ] Given the admin opens the dashboard, a "Permintaan" section lists requests with their derived state (open, submitted, accepted, expired) and shows a count badge for the ones needing attention, refreshing on load with no realtime or push.
- [ ] Given the admin creates a request with an optional name, optional WhatsApp number, and optional date, start, and end, a token is created and a link is shown.
- [ ] Given the link is generated, "Salin link" copies it, and given a WhatsApp number, the existing deep-link builder opens WhatsApp with an Indonesian Format Booking message containing the link; with no number, only copy is offered.
- [ ] Given a submitted request, "Jadikan Booking" opens the existing create form prefilled with the client's name, phone, date, start, end, event type, headcount, venue, and hairdo, while leaving service, notes, total, DP, and status to the admin.
- [ ] Given the admin picks a service on that form, the total is suggested as the service price multiplied by headcount, and the suggestion is not saved unless the admin leaves it in place; the remaining balance is shown as total minus DP and is never a stored field.
- [ ] Given the admin saves the prefilled form, the existing validation and the existing conflict guard run unchanged, and no request path can bypass either.
- [ ] Given a booking is created from a request, the request is linked to it and cannot be accepted a second time; given that booking is later deleted, the request becomes acceptable again.
- [ ] Given an expired or already-submitted request, accepting is refused with an Indonesian explanation.
- [ ] Given the admin edits the new booking fields directly (without any request involved), they can be set, changed, and cleared exactly like the existing fields.

## Comments
