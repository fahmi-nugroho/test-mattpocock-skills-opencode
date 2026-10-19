# 04: Correct a live link's prefill

**What to build:** A typo the admin made before sending — a wrong name, a wrong slot — can be fixed in the row itself while the client has not yet answered, without burning the token already sent: the correction is part of the same link. The write patches only the admin-owned prefill (the client's name and the requested date/start/end), runs the same requested-slot validation the create path uses, and is refused by the query itself once the client has answered or the link has lapsed, so a stale screen cannot rewrite a client's own request.

**Blocked by:** 03 — Delete a request.

**Status:** resolved

- [x] A guarded patch updates only the admin-owned prefill — the client's name and the requested date, start, and end — and only while the request is open.
- [x] The requested-slot validation the create path already uses runs before the write.
- [x] The guard is in the query itself: it matches only a request that is not yet answered and not yet lapsed, reads the row back on a refusal, and is covered by a test with the injected recording mock client.
- [x] An open row offers an inline edit for the name and the requested slot; saving updates the row in place under the same token and link.
- [x] A request the client has already answered cannot be corrected — refused by the query as well as by the control; the client's own answers are never editable.
- [x] A lapsed request cannot be corrected.
- [x] The copy makes clear that a client who already opened the form may still send the values they loaded.

## Comments

- 2026-10-19 — Resolved on `feat/booking-request-intake-spec`.
  - Guarded adapter `correctBookingRequest` in `src/lib/supabase/admin-requests.ts`, mirroring `linkBookingRequest`/`deleteBookingRequest`: `update({ client_name, date, start_time, end_time }).eq("id", requestId).is("submitted_at", null).is("accepted_booking_id", null).gt("expires_at", nowIso).select()`. The guard is the `open` state itself — not answered, not lapsed, not accepted — so a stale screen cannot rewrite a client's own request. `validateRequestSlot` (the create path's own rule) runs before any write. When the guarded write matches nothing, the row is read back and explained in Indonesian.
  - The input is `Required<BookingRequestPrefillInput>`: a correction writes the whole admin-owned prefill, so an omitted field cannot silently clear it. The shared `BookingRequestCreateInput` was renamed to `BookingRequestPrefillInput`, the honest name for the four fields both create and correct write (ticket wording: "the admin-owned prefill").
  - Correction copy has one home in `src/lib/admin/booking-request.ts`: `bookingRequestCorrectRefusal(status)` (null only for `open`, the Indonesian reason otherwise), `correctRefusalMessage(status)` (the thrown refusal, falling back to `muat ulang` for a lost race, parity with `refusalMessage`/`deleteRefusalMessage`), and `BOOKING_REQUEST_CORRECT_NOTICE` (the link keeps working, but a client who already opened the form may still send the values they loaded).
  - UI in `RequestsManager`: an `open` row shows `Ubah`, which swaps the name and the requested-slot line for inline inputs; `Simpan` calls the adapter and replaces the row in place (same token and link), `Batal` restores it. Non-open rows show a disabled `Ubah` plus the Indonesian reason, so the control refuses as well as the query. A failed correction surfaces the adapter's Indonesian message in the row.
  - Tests (10 new, 472 total): 3 pure tests over the correction copy and the notice; 7 adapter tests with the injected recording mock client — guard chain (`submitted_at is null`, `accepted_booking_id is null`, `expires_at > now`), create-path slot validation before any write, Indonesian refusals for answered / accepted / lapsed, a lost-race refusal, and a surfaced write failure rather than pretending the row changed.
  - Code review (standards + spec axes). Fixed: a stray word in the component doc comment; the correction's optional input, tightened to the full prefill so an omitted field cannot clear it. Deliberately kept: the row read-back duplication of the accept/delete paths (the spec mandates both guarded adapters follow that shape, and ticket 03's review kept the same), the per-status switches in `booking-request.ts` (the file's "single home for every status switch" job), the notice showing only in the edit panel (context copy, like the delete warning shown only on the armed row), and the `BookingRequestPrefillInput` rename (vocabulary alignment; no behaviour change).
  - Verified: `npm run typecheck` clean and full `vitest run` (472 passed).
