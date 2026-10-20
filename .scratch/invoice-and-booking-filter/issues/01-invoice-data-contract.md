# 01: Invoice data contract — table, allocation and payment settings

**What to build:** The database can turn a Booking into a numbered, frozen Invoice in one call. Creating an Invoice allocates the next `invc-NN/YYYY` safely even if two are issued at the same moment, copies the Booking's details and payment position into the Invoice itself, and refuses with an Indonesian reason when the Booking is cancelled, has no agreed total, has no DP recorded, has a DP above the total, or would get a due date before its issue date. The settings row gains the business's bank name, account name, account number and Instagram handle so every Invoice can print them. Invoices are readable and writable only by the signed-in admin and disappear when their Booking is deleted. This is the foundation every later ticket reads; it has no user-visible screen.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] A migration declares the admin-only `invoices` table with its identity, required Booking link, snapshot columns, `issued_on` and `due_on` dates, and a nullable `sent_at`.
- [x] Invoice numbers are unique, `(year, seq)` is unique, and the number's year always equals the year of its issue date, so an issue date can never be moved out of its series.
- [x] The table enforces `due_on >= issued_on`, `subtotal >= 0`, `dp_amount > 0`, `dp_amount <= subtotal`, and the existing `HH:MM` shape for start and end times.
- [x] An Invoice references its Booking with `on delete cascade`, and a per-booking newest-first lookup index exists.
- [x] A database function creates an Invoice from a booking id plus issue and due dates: it locks the year, allocates highest sequence + 1, builds the snapshot from the Booking row itself (service name empty when the service is gone), and inserts.
- [x] The function raises an Indonesian refusal for each of: cancelled Booking, no agreed total, no DP recorded, DP above the total, due date before issue date.
- [x] The settings row gains bank name, account name, account number and Instagram handle — non-null, empty-string defaults, and no new public exposure. They are seeded empty rather than prefilled.
- [x] RLS follows the booking-request privacy pattern: full access for the authenticated role, no policy for anonymous.
- [x] Declarative SQL tests assert the table, columns, constraints, cascade, index, RLS shape, allocation function and the four settings columns; the existing schema suite stays green.

## Comments

- 2026-10-20 — Resolved on `feat/invoice-and-booking-filter-spec`.
  - Added `supabase/migrations/0018_invoices_schema.sql`: the admin-only `invoices` snapshot table, its per-booking newest-first index, `create_invoice(uuid, date, date)`, and the four empty payment-settings columns.
  - Numbering: `number` and `(year, seq)` are unique; CHECKs pin `year` to `issued_on` and `number` to `invc-NN/YYYY` for that year and sequence. The function takes a transaction-scoped advisory lock on the year and allocates `max(seq) + 1`, then snapshots the Booking row itself (`coalesce(s.name, '')` when the service is gone).
  - Refusals are plain Indonesian `raise exception` messages for cancelled Booking, null agreed total, no recorded DP, DP above the total, and due date before issue date (plus not-found/null-date guards).
  - Privacy follows the `booking_requests` pattern: RLS enabled, full access for `authenticated`, no anon policy. `create_invoice` keeps invoker rights so RLS applies, revokes PUBLIC execute and grants only `authenticated`.
  - Settings gains `bank_name`, `account_name`, `account_number`, `instagram_handle`, all `not null default ''`. They stay behind `settings_admin_all`; no public RPC or anon policy exposes them. The ticket's "seeded empty" wins over the spec's earlier "seed from the current template" note.
  - Tests: new declarative SQL suite `src/lib/__tests__/invoice-schema.test.ts` (12 cases) asserts the table, snapshot columns, number/year invariants, amount/date/time CHECKs, cascade, index, allocation function, refusal phrases, RLS/grant shape and settings columns. `schema.test.ts` stays green.
  - Live verification: applied 0001, 0002, 0015, 0017 and 0018 to a throwaway PostgreSQL 18 cluster with `anon`/`authenticated` roles. Confirmed `invc-01/2026` → `invc-02/2026`, `invc-01/2027` restart, empty service fallback, all five refusals, booking-delete cascade, and PUBLIC-without/authenticated-with EXECUTE.
  - Code review (standards + spec axes). Fixed: snapshot-column test assertions now require a real column declaration rather than any mention in a CHECK; added an invoker-rights assertion. Deliberately unchanged: settings are empty per the ticket (the spec's seed note conflicts); sent-invoice immutability and date-edit rules belong to ticket 03; zero-total bookings cannot be invoiced by the spec's own `dp_amount > 0` + `dp_amount <= subtotal` rules; the explicit snapshot variable list keeps provenance visible.
  - `npm run typecheck` clean; full `vitest run` (503 passed).
