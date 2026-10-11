# 04: Public availability calendar

**What to build:** Read-only month calendar showing available / fully_booked / blocked per day from the derived day-status, so clients see roughly when to ask about without picking dates on-site.

**Blocked by:** 01 (status logic), 02 (month RPC data).

**Status:** ready-for-agent

- [ ] Month view with 3-color days + dot for partial occupancy, past dates greyed
- [ ] Uses `computeDayStatus` + month RPC (no client PII exposed)
- [ ] ID month names, responsive grid, general WA CTA below calendar
- [ ] Empty/loading states handled
