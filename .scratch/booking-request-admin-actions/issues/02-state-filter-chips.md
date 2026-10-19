# 02: Filter the list by state

**What to build:** The list can be narrowed to a single derived state — who needs action, who is still open, what has been accepted, what has lapsed — so chasing is a click and not a read-through. A pure filter returns the matching subset by reusing the same derived-state function the badge and the accept guard already use, so the chips can never tell a different story from them. A row of roving-tablist chips above the list chooses the state, and it composes with the search box rather than replacing it.

**Blocked by:** 01 — Search the Permintaan list.

**Status:** resolved

- [x] A pure filter takes the requests, the chosen filter, and an injected clock, and returns the matching subset via the existing derived-state function.
- [x] The filter vocabulary is: all, needs action (submitted), open, accepted, lapsed.
- [x] A request answered before its window lapsed reads as lapsed, matching the derivation and the accept guard (covered by a test against the existing row and clock fixtures).
- [x] A roving-tablist row of chips above the list offers one button per filter, the "show everything" chip selected by default, styled from the public portfolio category chips.
- [x] Chip labels agree with what the tab badge already counts.
- [x] Selecting a chip narrows the list; "show everything" restores the full list.
- [x] The chosen filter and the search box apply together — a request must match both.

## Comments

- 2026-10-19 — Resolved on `feat/booking-request-intake-spec`.
  - Added the pure state filter to `src/lib/admin/booking-request.ts`: `BOOKING_REQUEST_FILTERS` (the ordered vocabulary, type read off it), `BookingRequestFilter`, `BOOKING_REQUEST_FILTER_LABEL`, and `filterBookingRequests(requests, filter, now)`, which derives each request through the existing `deriveBookingRequestState` so the chips, the badge, and the accept guard share one rule. Labels are `Semua` / `Perlu ditindak` / `Terbuka` / `Diterima` / `Kedaluwarsa`; the state chips reuse `BOOKING_REQUEST_STATUS_LABEL` verbatim so a chip cannot drift from the row badge.
  - Tests (10 new) against the existing `REQUEST` and `NOW` fixtures in `booking-request-admin.test.ts`, including the boundary that an answered-but-lapsed request filters as lapsed (matching the derivation and the `expires_at > now` accept guard), that an accepted request outranks expiry, and that the injected clock — not the wall clock — drives the result.
  - UI in `RequestsManager`: a roving-tablist chip row above the list, styled from the public portfolio category chips (same classes), `Semua` selected by default, roving tabindex with Arrow/Home/End. The chosen chip runs first through `filterBookingRequests` with one clock pinned per list load, then the existing `filterByQuery`, so a row must match both. A filter-only empty result names the status instead of quoting an empty query.
  - Code review (standards + spec axes): both axes flagged that the tested `filterBookingRequests` seam was not the code path the UI ran; fixed by wiring it directly (with one pinned clock per load) instead of filtering pre-derived rows. Also derived the filter type off the order array and made the label test assert literal copy plus explicit reuse. No scope creep; the extra empty-state copy and keyboard handling are guards the ticket implies.
  - Verified: `npm run typecheck` clean and full `vitest run` (455 passed).
