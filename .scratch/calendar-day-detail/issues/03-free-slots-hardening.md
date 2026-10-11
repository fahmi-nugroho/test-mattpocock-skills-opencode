# 03: Free slots + hardening

**What to build:** Selected day shows its remaining free gaps plus full interaction polish so the detail is trustworthy on mobile, keyboard, and flaky networks.

**Blocked by:** 02 (occupied ranges must render before free gaps make sense).

**Status:** ready-for-agent

- [ ] Free slot gaps render as Sisa tersedia list derived server-side with no operating-hours values exposed; empty day keeps Seharian tersedia without hours header
- [ ] Keyboard-focusable days with pressed state, selected ring, detail announced politely, general + per-date chat links both work
- [ ] Loading, error+retry, empty, full, and closed states all covered; malformed payloads fail closed; full unit suite plus typecheck green with mobile-width check
