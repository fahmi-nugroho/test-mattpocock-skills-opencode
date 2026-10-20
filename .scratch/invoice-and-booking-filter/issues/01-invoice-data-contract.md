# 01: Invoice data contract — table, allocation and payment settings

**What to build:** The database can turn a Booking into a numbered, frozen Invoice in one call. Creating an Invoice allocates the next `invc-NN/YYYY` safely even if two are issued at the same moment, copies the Booking's details and payment position into the Invoice itself, and refuses with an Indonesian reason when the Booking is cancelled, has no agreed total, has no DP recorded, has a DP above the total, or would get a due date before its issue date. The settings row gains the business's bank name, account name, account number and Instagram handle so every Invoice can print them. Invoices are readable and writable only by the signed-in admin and disappear when their Booking is deleted. This is the foundation every later ticket reads; it has no user-visible screen.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A migration declares the admin-only `invoices` table with its identity, required Booking link, snapshot columns, `issued_on` and `due_on` dates, and a nullable `sent_at`.
- [ ] Invoice numbers are unique, `(year, seq)` is unique, and the number's year always equals the year of its issue date, so an issue date can never be moved out of its series.
- [ ] The table enforces `due_on >= issued_on`, `subtotal >= 0`, `dp_amount > 0`, `dp_amount <= subtotal`, and the existing `HH:MM` shape for start and end times.
- [ ] An Invoice references its Booking with `on delete cascade`, and a per-booking newest-first lookup index exists.
- [ ] A database function creates an Invoice from a booking id plus issue and due dates: it locks the year, allocates highest sequence + 1, builds the snapshot from the Booking row itself (service name empty when the service is gone), and inserts.
- [ ] The function raises an Indonesian refusal for each of: cancelled Booking, no agreed total, no DP recorded, DP above the total, due date before issue date.
- [ ] The settings row gains bank name, account name, account number and Instagram handle — non-null, empty-string defaults, and no new public exposure. They are seeded empty rather than prefilled.
- [ ] RLS follows the booking-request privacy pattern: full access for the authenticated role, no policy for anonymous.
- [ ] Declarative SQL tests assert the table, columns, constraints, cascade, index, RLS shape, allocation function and the four settings columns; the existing schema suite stays green.
