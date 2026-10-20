# 06: Filter Bookings by status

**What to build:** The bookings dialog gains Semua, Menunggu, Terkonfirmasi and Dibatalkan chips that narrow the list to one status while the search box still narrows within it. Filtering happens before search, so a Booking must match both. The Mendatang/Riwayat split and its paging operate on the filtered rows, so a cancelled future Booking still appears under Mendatang. Every chip or search change opens both groups at a single page and a filtered list with no matches says so plainly. The trigger's summary counts keep describing all Bookings, not the filtered set. The chips are keyboard-operable with the same roving-tablist pattern as the Permintaan list.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A pure booking filter exposes the ordered vocabulary all, pending, confirmed, cancelled and its labels, reusing the labels the rows already print (moved into the shared pure module so a chip cannot drift from a row).
- [ ] The filter is tested for all, each status, an empty result, and composition with the search (a Booking must match both).
- [ ] The Mendatang/Riwayat split and each group's page size are applied after filtering; a cancelled future Booking appears under Mendatang.
- [ ] Changing the chip or the search text resets both groups to one page.
- [ ] The trigger's summary counts continue to be computed from all Bookings.
- [ ] Chips form a roving tablist with ArrowLeft/ArrowRight/Home/End movement and a single tab stop.
- [ ] A filtered list matching nothing shows a plain Indonesian no-results message.
