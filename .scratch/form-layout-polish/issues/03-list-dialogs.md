# 03: Move the two lists into dialogs

**What to build:** The Booking list and the Permintaan list move out of their sections and into dialogs, so a section shows a summary and a trigger instead of every row ever recorded. Each dialog holds the attention badge, the refresh button, the state chips, the search box, every row, and every row action — nothing is left behind and nothing new is added. The Booking dialog splits its rows into *Mendatang* and *Riwayat*; both dialogs cap what they show at ten rows per list with a "Muat lebih banyak" step. Both dialogs are built on one new shared dialog component; the two modals already on the public site are deliberately not migrated to it.

**Blocked by:** 01 and 02 — all three tickets rewrite the same two manager components, and this one relocates the markup 02 edits.

**Status:** ready-for-agent

- [ ] One shared dialog component owns the overlay, the Escape key, backdrop dismissal, the body scroll-lock, focus into the panel on open, focus back to the trigger on close, a titled default panel with a close button, and a panel-class escape hatch; it is a controlled component, not a hook, and it carries no variant enum.
- [ ] The Booking section keeps its create form and gains a summary plus a trigger; the Permintaan section keeps its link form and gains a summary plus a trigger.
- [ ] The Booking trigger states how many rows are upcoming and how many of those are still waiting, reusing the existing overview counts; the Permintaan trigger states the "perlu ditindak" count the badge already computes.
- [ ] Each dialog contains the attention badge, the refresh button, the chips, the search box, the rows, and every row action — including the inline edit rows, the two-click delete confirmation, and the per-row error and refusal messages.
- [ ] "Jadikan Booking" inside the Permintaan dialog still hands the draft to the booking form and closes the dialog, with the form prefilled exactly as before.
- [ ] The Booking dialog splits rows into *Mendatang* (date on or after today, ordered by date then start) and *Riwayat* (date before today, newest first), each under its own heading.
- [ ] Each list shows ten rows, "Muat lebih banyak" reveals ten more and states how many are still hidden, and the reveal resets to the first ten whenever the chip or the search text changes.
- [ ] The Permintaan dialog applies one cap over the currently filtered set (no date grouping there).
- [ ] An empty list and a search that matches nothing keep their own distinct messages.
- [ ] The attention count is still computed from the same load and still reported to the page, so the tab badge cannot disagree with the dialog; the cross-panel schedule refetch still works.
- [ ] Opening a dialog fetches nothing: both read the rows the section already loaded, and no adapter, query, or limit changes.
- [ ] The dialog fits a phone and its own content scrolls; the page behind does not scroll while it is open.
- [ ] After this ticket the dashboard page no longer grows with the number of Bookings or Booking Requests.

## Comments
