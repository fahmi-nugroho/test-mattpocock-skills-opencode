# 05: Calendar restyle with single inquiry CTA

**What to build:** the availability calendar restyled to warm-tinted Tersedia / Penuh / Tutup with clearer selection and one primary WA action, so a client reads availability without confusion.

**Blocked by:** 01 (needs tokens and width foundation).

**Status:** resolved

- [x] Day colors keep existing semantics with legend intact, restyled to warm tints with stronger selected-day ring and muted past days
- [x] Day detail panel consolidates to a single primary WA CTA with correct date prefill; occupied ranges still listed without client PII
- [x] Calendar derivation and RPC contracts unchanged (visual + copy change only)

## Comments

Resolved on `integration/ui-ux-polish` at `e51b82f` (feature `fd6fb12` + review-fix `de83ac8`). 219/219 Vitest pass, tsc clean, `next build` green. Code-review: standards 0 findings; spec 1 finding fixed (general starter stays visible until day detail resolves, so exactly one WA CTA at every state — no zero-CTA gap during load/error). Warm tints / legend / selected ring / muted past days landed via 01 and verified intact; derivation and RPC wiring untouched.

- [ ] Day colors keep existing semantics with legend intact, restyled to warm tints with stronger selected-day ring and muted past days
- [ ] Day detail panel consolidates to a single primary WA CTA with correct date prefill; occupied ranges still listed without client PII
- [ ] Calendar derivation and RPC contracts unchanged (visual + copy change only)
