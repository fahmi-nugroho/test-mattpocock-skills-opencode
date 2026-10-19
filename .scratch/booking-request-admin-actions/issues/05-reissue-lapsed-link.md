# 05: Re-issue a lapsed link

**What to build:** A client who never answered can be asked again: a lapsed request offers "Buat link baru", which creates a fresh request carrying the name and the slot from the old one, with a brand-new token and a fresh seven-day window. Nothing about the old request is mutated, so what was originally asked stays readable as history; a dead token is never revived. The flow says plainly that the client must fill the form again and that only the name and slot are carried over.

**Blocked by:** 04 — Correct a live link's prefill.

**Status:** resolved

- [x] Only a lapsed row offers "Buat link baru".
- [x] It creates a fresh request carrying the client name and the requested slot from the old row.
- [x] The fresh link has a new token and a fresh seven-day window; a dead token is never revived.
- [x] The old request is left untouched and stays readable as history.
- [x] The flow states plainly that the client must fill the form again and that only the name and slot are carried over.
- [x] The new request appears in the list immediately.

## Comments

- 2026-10-19 — Resolved on `feat/booking-request-intake-spec`.
  - Re-issue reuses the create path, as the spec decided: `onReissue` in `RequestsManager` calls the same `createBookingRequest` the link form calls, with `requestToReissuePrefill(item)` copied from the old row. Nothing about the old row is written, so its history is untouched; the new token and the DB's `now() + interval '7 days'` default (migration `0015`) give a fresh clock, and a dead token is never revived.
  - The carry-over contract has one home in `src/lib/admin/booking-request.ts`: `requestToReissuePrefill(request): BookingRequestReissuePrefill` returns only `client_name`, `date`, `start_time`, `end_time` — never the phone, event, headcount, venue, style, reference, or notes the client may have sent. `bookingRequestCanReissue(status)` is true only for `expired`, and `BOOKING_REQUEST_REISSUE_NOTICE` states plainly that the client must fill the form again and that only the name and slot carry over.
  - UI in `RequestsManager`: only a lapsed row renders "Buat link baru" (beside the disabled "Jadikan Booking" that already points here), with the notice beneath it. On success the fresh link surfaces in the same created panel (reusing `createAndSurface`, extracted from `onCreate`), the new row is prepended, and the filter drops back to `all` so the fresh open row is visible at once alongside the old lapsed row kept as history. No WhatsApp number is carried, so the created panel offers copy only.
  - Deliberate choices: `bookingRequestCanReissue` is a predicate, not a `*Refusal` returning copy, because a non-lapsed row hides the action rather than showing a disabled one with a reason (matching the spec's state-aware row actions and ticket 06's "hidden where meaningless"). The per-row `rowBusy` state was widened from a bare id to `{ id, action }` so a third in-flight action cannot mislabel the sibling buttons ("Membuat…" no longer puts "Menghapus…" on the delete button). The admin-owned `BookingRequestPrefillInput` moved from `admin-requests.ts` to `booking-request.ts` so create, correct, and re-issue share one shape (adapter depends on pure, not the reverse).
  - Tests (4 new, 476 total): 2 pure copy tests over `bookingRequestCanReissue`/`BOOKING_REQUEST_REISSUE_NOTICE`, and 2 over `requestToReissuePrefill` (carries name + slot only; absent slot stays null). The component row action stays manual QA, as the spec's testing decisions specify.
  - Code review (standards + spec axes). Fixed: extracted `createAndSurface` to remove the create→link→surface duplication with `onCreate`; unified the prefill type to kill the data clump and the standalone `BookingRequestReissuePrefill` interface; reset the filter to `all` on success so the new row is not filtered out under the "Kedaluwarsa" chip (the spec's own re-issue workflow); refreshed the pure-seam note in the test header. Deliberately kept: the boolean `bookingRequestCanReissue` (a hidden action, not a refusal with unused copy).
  - Verified: `npm run typecheck` clean and full `vitest run` (476 passed). `npm run lint` is broken repo-wide (`next lint` was removed in Next 16) and is unrelated to this change.
