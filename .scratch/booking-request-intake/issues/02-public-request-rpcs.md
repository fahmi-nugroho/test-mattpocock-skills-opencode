# 02: Public read and submit functions for a request token

**What to build:** The two security-definer functions that are the only way the public touches a Booking Request, plus their client-side wrappers and the fail-closed payload validator and row mapper.

**Blocked by:** 01 (needs the table and its constraints).

**Status:** needs-triage

- [ ] Given a valid, unexpired, unsubmitted token, the read function returns only the context the admin supplied — optionally the client name and the requested date, start, and end — and no price and no other client's data.
- [ ] Given a token that is already submitted or already expired, the read function refuses to return form context, so the page can show the right state instead.
- [ ] Given a valid token and a well-formed payload, the submit function writes only client-owned columns and sets the submitted timestamp.
- [ ] Given a missing, unknown, expired, or already-submitted token, the submit function writes nothing and reports the reason.
- [ ] Given a payload with an empty name, a phone shorter than nine digits, a headcount below one, an unparseable date or time, or a start that is not before the end, the submit function rejects it, and the client-side validator rejects it with the same rules before the call is made.
- [ ] Given a payload carrying extra or oversized keys, the client-side validator fails closed and strips what it does not recognise.
- [ ] Given the anonymous role, both functions are executable and no other table access is granted.
- [ ] Given an injected mock client, the wrappers call the right function with the right arguments and surface errors instead of swallowing them.

## Comments
