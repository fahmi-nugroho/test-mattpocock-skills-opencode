# 02: Booked slot + blocked slot timed ranges

**What to build:** Selected day lists its occupied time ranges labelled by kind so clients can tell taken vs closed slices apart, with no personal data.

**Blocked by:** 01 (selectable day + closure shell must exist first).

**Status:** ready-for-agent

- [ ] Booked slot ranges (confirmed bookings only) render as Terisi HH:MM–HH:MM sorted chronologically; pending/cancelled never appear
- [ ] Blocked slot ranges (timed blocks) render as Tutup HH:MM–HH:MM with distinct label/colour from booked; all-day closure still outranks and collapses to single row
- [ ] Adjacent same-kind intervals merged for display; overlapping different-kind keeps both labels in order (defensive, admin guards already prevent overlap)
- [ ] Validator rejects malformed times/kinds and strips extra keys so names/phones/notes/reasons can never leak; unit tests cover sort/merge/confirmed-only/PII-strip
