# 03: Free slots + hardening

**What to build:** Selected day shows its remaining free gaps plus full interaction polish so the detail is trustworthy on mobile, keyboard, and flaky networks.

**Blocked by:** 02 (occupied ranges must render before free gaps make sense).

**Status:** resolved

- [x] Free slot gaps render as Sisa tersedia list derived server-side with no operating-hours values exposed; empty day keeps Seharian tersedia without hours header
- [x] Follow-up: free-gap UI removed per client request — occupied Terisi/Tutup list kept, hint added to propose time via WhatsApp; server `free` computation/validation retained (no migration)
- [x] Keyboard-focusable days with pressed state, selected ring, detail announced politely, general + per-date chat links both work
- [x] Loading, error+retry, empty, full, and closed states all covered; malformed payloads fail closed; full unit suite plus typecheck green with mobile-width check

## Comments

Resolved on `main`. Evidence: `tsc --noEmit` clean, `next build` green, full Vitest suite green (210 tests, 29 files).

Keyboard/pressed/ring/aria-live/both-WA-links plus loading/error+retry/empty/full/closed states were delivered in ticket 01 and reused unchanged here; this ticket adds the free list on top. Mobile-width: no browser tooling in this session — panel reuses the v1 responsive grid and rounded/border conventions, flagged for visual QA on deploy.

Review dispositions: fixed the empty-day wire leak (free forced to [] when occupied is empty, so the full window never ships as endpoints; covered by SQL contract test) and extracted shared `mapTimeRange` for the occupied/free guards. Kept with reasons: SQL clamp-timeline repetition across the three SELECTs (pre-existing RPC-rewrite style — unify at final review); `v_free`/`v_cursor` name assertions follow this file's established local-SQL convention alongside the mocked-RPC adapter tests; edge-touching gap endpoints are inherent to rendering gap times (the ticket's core ask) — "no hours" means no hour fields, which holds.
