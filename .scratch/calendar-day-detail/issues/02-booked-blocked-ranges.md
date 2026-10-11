# 02: Booked slot + blocked slot timed ranges

**What to build:** Selected day lists its occupied time ranges labelled by kind so clients can tell taken vs closed slices apart, with no personal data.

**Blocked by:** 01 (selectable day + closure shell must exist first).

**Status:** resolved

- [x] Booked slot ranges (confirmed bookings only) render as Terisi HH:MM–HH:MM sorted chronologically; pending/cancelled never appear
- [x] Blocked slot ranges (timed blocks) render as Tutup HH:MM–HH:MM with distinct label/colour from booked; all-day closure still outranks and collapses to single row
- [x] Adjacent same-kind intervals merged for display; overlapping different-kind keeps both labels in order (defensive, admin guards already prevent overlap)
- [x] Validator rejects malformed times/kinds and strips extra keys so names/phones/notes/reasons can never leak; unit tests cover sort/merge/confirmed-only/PII-strip

## Comments

Resolved on `main`. Evidence: `tsc --noEmit` clean, `next build` green, full Vitest suite green (206 tests, 29 files).

Review dispositions: fixed kind-dispatch duplication via `OCCUPIED_META` map and deterministic same-start tiebreak (`order by s, kind` in SQL mirrored in `mergeOccupied` comparator + test). Kept with reasons: defensive overlap merge (ticket-mandated defensive posture); SQL clamp-query duplication with the 0007 coverage CTE (pre-existing shape, unify at review stage); confirmed-only covered by SQL contract test per spec Testing Decisions (no live DB in unit tests); display-side merge is the specced Q8 design; `fully_booked` CTE text reappears only because 0008 replaces the whole function — status derivation unchanged.
