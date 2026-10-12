# 01: Window-free day schedule data

**What to build:** The public day schedule returns raw unclamped occupied ranges so bookings at any hour of the day are visible, with the operating-window coverage derivation removed and the privacy contract intact.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Given a date with confirmed bookings or timed blocks at any hour, the public day result lists every occupied range with start, end, and kind only, sorted chronologically, with no clamping and no dropped ranges.
- [ ] Given extra keys carrying personal data or hours in the raw payload, the validator strips them and fails closed on malformed shapes.
- [ ] Pending and cancelled bookings never occupy and never appear; all-day closure still outranks times.
- [ ] Mocked-payload unit tests cover raw multi-range days, empty days, all-day closure, malformed rows, and leak-attempt payloads.
