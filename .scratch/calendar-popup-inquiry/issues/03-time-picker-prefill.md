# 03: Time picker with datetime chat prefill

**What to build:** The popup lets the client propose a start and end time to ask about, validated live against the shown occupied ranges, and prefills the chosen time into the chat message.

**Blocked by:** 02 (needs the popup shell).

**Status:** ready-for-agent

- [ ] Given the popup on a bookable day, empty start and end inputs with a choose-a-time hint are shown; given a full or closed-all-day popup, no picker and no date chat action appear.
- [ ] Given an end time not after the start time, an order error shows and the date chat action stays disabled.
- [ ] Given a chosen range overlapping any booked or blocked range under half-open semantics (touching edges allowed), an overlap error shows and the date chat action stays disabled.
- [ ] Given a valid non-overlapping range, the date chat action enables and its message carries the date plus the chosen start-end range; a secondary time-less date chat action remains available.
- [ ] Pure unit tests cover overlap verdicts (overlap, touching, contained, inverted) and the date-plus-time message building with encoding.
