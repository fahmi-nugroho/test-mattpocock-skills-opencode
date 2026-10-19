# 01: Tidy the two admin forms

**What to build:** The Booking section's "Tambah booking" form and the Permintaan section's "Buat link Format Booking" form stop being one flat two-column grid in storage order. Their fields group into labelled fieldsets, each an internal two-column grid that fills its rows, so no row ends in a dangling empty cell — today the DP amount is stranded alone beside the full-width notes field, the status select opens a row by itself, the link form pads its date row with an invisible spacer, and the Style radios occupy a full-width fieldset for two short labels. The radios move inside their group as chips. Every field, label, placeholder, validation rule, and guard is unchanged; only the arrangement changes.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The Booking create form groups its fields into labelled fieldsets — schedule (date, start, end, status), client (name, number), job (event, Headcount, venue, Style, Reference), and money and notes (total, DP, remaining balance, notes).
- [ ] The link form groups its fields too — client and send-to, then the optional slot — and no longer pads a row with an invisible spacer cell.
- [ ] Each fieldset lays its fields out in two columns at small breakpoints and up, filling its rows; no row is left with an empty cell at any breakpoint.
- [ ] The Style radios sit as chips inside the job group instead of a full-width fieldset, and the read-only legacy Style line still appears when a prefill or a stored row carries one.
- [ ] The create form's remaining-balance line and total suggestion, the overlap guard, and every validation message behave exactly as before.
- [ ] Every field, label, hint, and placeholder is preserved verbatim; the only new text is the fieldset legends.
- [ ] Both forms are usable at 360px: single column, no horizontal overflow, no clipped control.

## Comments
