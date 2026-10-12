# 04: Hours-removal contract with month and admin cleanup

**What to build:** Operating hours are removed from the product end to end once every reader has migrated, with month status, admin settings, seeds, and tests consistent and the decision recorded.

**Blocked by:** 01, 02 (every hours reader migrated; 03 runs parallel since it never touches hours).

**Status:** ready-for-agent

- [ ] Given the migrated public callers, the settings hours columns are dropped via a forward migration carrying a restore note, and the day-status derivation no longer takes a window.
- [ ] Given any date, the public month result resolves to closed for full-toggle or all-day blocks and available otherwise; the full status is unreachable but its legend and metadata remain as dead code.
- [ ] Given the admin settings form, no operating-hours inputs are shown and hours validation, seeds, and fixtures carry no hours.
- [ ] Given the full suite plus typecheck, everything is green; an ADR records why the window and coverage derivation were removed and what would revive the full status.
