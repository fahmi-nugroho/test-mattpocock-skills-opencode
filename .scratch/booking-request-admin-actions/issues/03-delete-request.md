# 03: Delete a request

**What to build:** A request the artist will never act on — a client who never answered, spam that got past the entry point, an accidental duplicate — can be removed, after two deliberate clicks. The rule that protects the record lives in the query, not only in the button: a request that has become a Booking is refused, and the row says why in Indonesian and points at the route that works (delete the Booking instead, which releases the request through the existing foreign key). A deleted request leaves the list immediately.

**Blocked by:** 02 — Filter the list by state.

**Status:** resolved

- [x] A guarded delete removes a request only when it is not linked to a Booking; the guard is in the query itself and is covered by a test with the injected recording mock client.
- [x] On refusal the row is read back and explained in Indonesian; a failed delete surfaces that message in the row.
- [x] Deleting takes two deliberate clicks, and the confirm step warns that deleting kills the client's link.
- [x] A deleted request disappears from the list immediately.
- [x] An accepted request cannot be deleted; the row explains why in Indonesian and points at deleting the Booking as the route that works.
- [x] Deleting a request dispatches no schedule event (a request never occupies the calendar).

## Comments

- 2026-10-19 — Resolved on `feat/booking-request-intake-spec`.
  - Guarded adapter `deleteBookingRequest` in `src/lib/supabase/admin-requests.ts`, mirroring `linkBookingRequest`'s established shape: `delete().eq("id", requestId).is("accepted_booking_id", null).select()`. The guard lives in the query, not the button. When the guarded delete matches nothing, the row is read back and the refusal is explained in Indonesian, pointing at deleting the Booking (whose `on delete set null` FK releases the request). It dispatches no schedule event — a request never occupies the calendar — and the doc comment says so.
  - The row's delete copy has one home in `src/lib/admin/booking-request.ts` (consistent with the file's "single home for every status switch" job): `bookingRequestDeleteRefusal(status)` (null when deletable, the Indonesian reason when accepted), `deleteRefusalMessage(status)` (the thrown refusal, falling back to `muat ulang` for a lost race, exactly as `refusalMessage` does for accept), and `BOOKING_REQUEST_DELETE_WARNING` (the confirm step's warning that the client's link dies).
  - UI in `RequestsManager`: two deliberate clicks (`confirmDeleteId` arms on the first, deletes on the second), the warning shown on the armed row, and a per-row `rowError` so a failed delete surfaces the adapter's Indonesian message in the row rather than at the top of the section. An accepted row shows a disabled `Hapus` plus the reason pointing at the Booking. On success the row leaves the list at once and the badge count is recomputed from the new list.
  - Tests (7 new, 462 total): 4 adapter tests with the injected recording mock client — deletes behind the `accepted_booking_id is null` guard, refuses an accepted request pointing at deleting the Booking, explains a lost-race refusal, and surfaces a delete failure rather than pretending the row is gone; 3 pure tests over the delete copy and the warning.
  - Code review (standards + spec axes). Fixed: the delete handler re-derived the badge predicate inline, duplicating the load effect; both now reuse `filterBookingRequests(..., "needs_action", now)`, which is the chip vocabulary's own name for what the badge counts, with the delete pinned to the same per-load clock as the visible rows. Deliberately kept: the read-back duplication of the accept path (the spec mandates both guarded adapters follow that shape), the `deleteRefusalMessage` wrapper (parity with `refusalMessage`), and the text-only "delete the Booking" pointer (a jump to a specific Booking does not exist). The spec axis flagged the badge recompute as ticket 07's territory; kept because ticket 03 promises the section reflects the delete immediately, and a stale count would visibly disagree with the list (user stories 13/20).
  - Verified: `npm run typecheck` clean and full `vitest run` (462 passed).
