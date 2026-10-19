# 06: Re-send a live link

**What to build:** A client who lost the message can be sent the link again without creating anything new: the row offers copying a live link once more, and opening WhatsApp with it prefilled. The number to send to is typed into a per-row field that is never written to the database — mirroring the link form's deliberate "not stored" decision — and is pre-filled from the request's own number when the client supplied one, so re-sending an answered request is genuinely one tap. Both actions are hidden where they would be meaningless for the row's state.

**Blocked by:** 05 — Re-issue a lapsed link.

**Status:** resolved

- [x] A live row offers copying the link again, and sending it via WhatsApp.
- [x] Copying needs no stored state and reports a failure in Indonesian when it cannot copy.
- [x] The WhatsApp action uses a number typed into a per-row field that is never written to the database.
- [x] That field is pre-filled from the request's own number when the client supplied one.
- [x] The copy and re-send actions are hidden on rows where they would be meaningless for that state.

## Comments

- 2026-10-19 — Resolved on `feat/booking-request-intake-spec`.
  - "Live" means the link is still worth sending: open (waiting on the client) or answered (the client may still need it). The predicate `bookingRequestCanResend(status)` in `src/lib/admin/booking-request.ts` is true only for `open` and `submitted`, false for `accepted` (spent) and `expired` (re-issued, not re-sent), so the copy and WhatsApp controls are hidden — not disabled — where they would be meaningless, matching the spec's state-aware row actions.
  - The spec's "State-aware row actions" line ("a live link can be copied, re-sent, or corrected … an answered one can be accepted") reads as an exclusion, but the ticket body and user story 34 settle it: the number field is "pre-filled from the request's own number when the client supplied one, so re-sending an answered request is genuinely one tap", and `client_phone` is only ever populated by the client's own answer. A `submitted` row therefore offers re-send (pre-filled, one tap) alongside accept; `expired`/`accepted` offer neither. The same loose reading is why "corrected" sits under "live" though correction is open-only (ticket 04).
  - Copy failure has one home: `BOOKING_REQUEST_COPY_FAILURE` ("Gagal menyalin link. Coba lagi."), now shared by the created-panel `Salin link` and the per-row copy through one extracted `writeToClipboard` helper, so the two copy actions cannot drift. The failure surfaces in the row (`rowError`, Indonesian), per user story 40.
  - UI in `RequestsManager`: live rows render `Salin link` (with the existing `Tersalin` acknowledgement), a per-row `type="tel"` field (`resendNumbers`, keyed by id, never passed to any adapter or query), and `Kirim via WhatsApp` (`buildFormatBookingWaLink`) disabled until a number is present. The field is read as `resendNumbers[id] ?? item.client_phone`, so an answered request is prefilled and genuinely one tap while an open one stays blank until the admin types. Link building for the created panel, re-issue, and every row now reads the single guarded `origin`.
  - Scope note: `rowError` was moved from inside the delete block to the row's action line, because the new copy control sits outside that block and its failure needed a row-level home; all row errors (delete, correct, re-issue, copy) now render in one place.
  - Tests (2 new, 478 total): the predicate over all four states (open/submitted true, accepted/expired false) and the Indonesian copy-failure copy. The row markup itself stays manual QA, as the spec's testing decisions specify.
  - Code review (standards + spec axes). Fixed: `onCopyResend` duplicated `onCopy`'s clipboard tail and the two carried different Indonesian failure strings — extracted `writeToClipboard` and unified on `BOOKING_REQUEST_COPY_FAILURE`; the render-time `origin` guard was inconsistent with the direct `window.location.origin` reads in the handlers — centralized one guarded `origin` used by created panel, re-issue, and rows. Deliberately kept: the `bookingRequestCanResend`/`bookingRequestCanReissue` pair (parallel predicates are the file's existing "single home for every status switch" pattern), and the `rowError` relocation (the copy control needs a row-level home).
  - Verified: `npm run typecheck` clean and full `vitest run` (478 passed). `npm run lint` remains broken repo-wide (`next lint` removed in Next 16), unrelated to this change.
