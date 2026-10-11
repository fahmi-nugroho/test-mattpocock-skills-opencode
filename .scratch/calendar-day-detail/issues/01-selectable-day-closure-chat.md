# 01: Selectable day + all-day closure + date chat

**What to build:** Tap a today/future calendar day to see that day's detail below the grid with date + Day Status header, showing Sehari penuh — Tutup for an All-day closure or Seharian tersedia when empty, with a per-date chat button that prefills only the date. Past days stay inert and muted.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Future/today days are selectable buttons with selected ring; past days inert muted; tapping selected day deselects; changing month clears selection
- [x] Detail panel shows date + Day Status label with loading and error+retry states, announced politely
- [x] All-day closure renders as single Sehari penuh — Tutup row; empty day renders Seharian tersedia; no operating-hours values reach the browser
- [x] Per-date chat button prefills selected date only; existing general chat button unchanged; no PII (names/phones/notes/reasons) ever shown
- [x] Day-schedule public function v1 (status + all-day flag) with anon grant, validator strips extra keys and fails closed, unit tests green

## Comments

Resolved on `main` in `9f291dd`. Evidence: `tsc --noEmit` clean, `next build` green, 195/195 Vitest pass (29 files).

Pre-commit review fixes: validator now rejects non-array `occupied`/`free` (fail closed); closed row keys off `status === "blocked" || allDayBlocked` so a blocked status can never pair with an open-day body.

Kept as agreed: ISO date in WA prefill (per Q9 approval), `occupied`/`free` empty-array shape + `authenticated` grant + `fully_booked` branch (forward-compat / reachable-state justifications). Deferred: `useRpc` extraction and detail tone-map refactor land after ticket 03 (02/03 grow the panel first); `formatDayId` naming kept for `formatMonthId` consistency.
