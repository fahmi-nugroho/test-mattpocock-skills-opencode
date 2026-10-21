# 06: Filter Bookings by status

**What to build:** The bookings dialog gains Semua, Menunggu, Terkonfirmasi and Dibatalkan chips that narrow the list to one status while the search box still narrows within it. Filtering happens before search, so a Booking must match both. The Mendatang/Riwayat split and its paging operate on the filtered rows, so a cancelled future Booking still appears under Mendatang. Every chip or search change opens both groups at a single page and a filtered list with no matches says so plainly. The trigger's summary counts keep describing all Bookings, not the filtered set. The chips are keyboard-operable with the same roving-tablist pattern as the Permintaan list.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] A pure booking filter exposes the ordered vocabulary all, pending, confirmed, cancelled and its labels, reusing the labels the rows already print (moved into the shared pure module so a chip cannot drift from a row).
- [x] The filter is tested for all, each status, an empty result, and composition with the search (a Booking must match both).
- [x] The Mendatang/Riwayat split and each group's page size are applied after filtering; a cancelled future Booking appears under Mendatang.
- [x] Changing the chip or the search text resets both groups to one page.
- [x] The trigger's summary counts continue to be computed from all Bookings.
- [x] Chips form a roving tablist with ArrowLeft/ArrowRight/Home/End movement and a single tab stop.
- [x] A filtered list matching nothing shows a plain Indonesian no-results message.

## Comments

- 2026-10-21 — Resolved on `feat/invoice-and-booking-filter-spec`.
  - Added the pure `src/lib/admin/booking-filter.ts`: the ordered `BOOKING_FILTERS` vocabulary (`all`, `pending`, `confirmed`, `cancelled`), `BOOKING_STATUS_LABEL` moved out of the manager so rows and chips read one copy, `BOOKING_FILTER_LABEL`, and `filterBookings`.
  - `BookingsManager` runs `filterBookings` before `filterByQuery`, then splits the filtered rows into Mendatang/Riwayat and windows each group at `LIST_PAGE_SIZE`. Changing the chip or the search resets both group windows. The trigger summary still comes from `summarizeBookings(items, todayKey)` over every Booking.
  - Added a roving-tablist chip row matching the Permintaan pattern (ArrowLeft/ArrowRight wrap, Home/End, one tab stop), and a plain Indonesian no-results sentence that names the status when a chip and search together match nothing.
  - Tests: `booking-filter.test.ts` covers the vocabulary, all four chips, an empty result, composition with the search, a cancelled future Booking under Mendatang, and filtered paging. `npm run typecheck` clean; full `vitest run` 582 passed across 61 suites.
  - Code review (standards + spec axes). Fixed: the ticket is marked resolved; the two page-reset copies share one helper; the no-results copy now names the chosen status under an active search. Deliberately unchanged: the chip markup/keyboard handler mirrors `requests-manager.tsx` because the ticket asks for that same pattern, and `BOOKING_STATUSES` moved with the labels so the dropdown cannot drift either.
