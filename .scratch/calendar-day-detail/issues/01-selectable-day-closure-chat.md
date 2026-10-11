# 01: Selectable day + all-day closure + date chat

**What to build:** Tap a today/future calendar day to see that day's detail below the grid with date + Day Status header, showing Sehari penuh — Tutup for an All-day closure or Seharian tersedia when empty, with a per-date chat button that prefills only the date. Past days stay inert and muted.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Future/today days are selectable buttons with selected ring; past days inert muted; tapping selected day deselects; changing month clears selection
- [ ] Detail panel shows date + Day Status label with loading and error+retry states, announced politely
- [ ] All-day closure renders as single Sehari penuh — Tutup row; empty day renders Seharian tersedia; no operating-hours values reach the browser
- [ ] Per-date chat button prefills selected date only; existing general chat button unchanged; no PII (names/phones/notes/reasons) ever shown
- [ ] Day-schedule public function v1 (status + all-day flag) with anon grant, validator strips extra keys and fails closed, unit tests green
