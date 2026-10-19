# 02: Label the inline edit rows

**What to build:** Every inline row editor on the Booking list and the Permintaan list gains the visible label its create-form counterpart already has, wired to its input, plus the same placeholder for the fields that can legitimately be blank. Today each input carries a screen-reader-only name and no visible one, and only the Reference box has a placeholder — so on a populated edit row (every edit row is populated) there is neither text in the box nor a label above it. Placeholders alone would not have fixed this; the label is what makes the row readable.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Every input in the Booking row editor shows a visible label naming it the same way the create form names it (date, status, start, end, client name, client number, event, Headcount, venue, Reference, total, DP, notes).
- [ ] Every input in the Permintaan row editor shows a visible label (client name, requested date, requested start, requested end).
- [ ] Each label is associated with its input, so clicking the label focuses the box and the accessible name is the visible text rather than a separate screen-reader-only string.
- [ ] Optional inputs carry the save-as-create placeholders — the Reference box, the client-number box, the event box, the venue box, and the total box.
- [ ] The Style radios and the read-only legacy Style line inside the Booking row editor are unchanged.
- [ ] Save, cancel, and every guard behave exactly as before; the rows' layout still reads as one row of fields plus its actions.
- [ ] The labelled rows stay usable at 360px without horizontal overflow.

## Comments
