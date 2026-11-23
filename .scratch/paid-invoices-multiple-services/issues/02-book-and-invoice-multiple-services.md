# 02: Book and invoice multiple Services

**What to build:** The admin can select several **Layanan** on a Booking and issue an Invoice that lists every selected Service. The Booking retains the names used when the Services were selected, so later catalog changes cannot alter the scope shown to the client.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Both admin Booking forms support adding and removing multiple optional Services, including when accepting a Booking Request. Each selected Service appears once. The public Format Booking continues to collect request details.
- [x] One Service suggests catalog price multiplied by Booking Headcount, and the admin can override it. Multiple Services use one manually entered Agreed Total. Headcount describes the whole Booking.
- [x] Renaming or deleting a catalog Service preserves its selected name on existing Bookings until the admin changes the selection. Carry forward the available name for legacy single-Service Bookings and support Bookings whose old link is already missing.
- [x] The Booking list and search recognize all selected names. The Calendar Mirror uses those saved names in its existing Service description for confirmed Bookings.
- [x] Every newly issued Invoice lists all selected Services, including an outstanding Invoice and a **LUNAS** Invoice. It shows one Agreed Total for the Booking. Long lists remain legible in the preview and exported image.
- [x] The Invoice snapshots the Service names at issue and uses the list for duplicate comparison. Later Booking and catalog edits leave earlier Invoices reproducible with their saved names, including legacy single-Service Invoices.
- [x] Existing Booking, Invoice issue and layout, and Calendar Mirror tests cover the saved names, legacy data, complete Invoice list, and long lists. Check the price behavior in the existing admin forms.

## Comments

- Verified with typechecking, all 734 tests, a local PostgreSQL migration check, and mobile Chromium covering both admin forms, Booking Request acceptance, and a 40-Service Invoice download.
