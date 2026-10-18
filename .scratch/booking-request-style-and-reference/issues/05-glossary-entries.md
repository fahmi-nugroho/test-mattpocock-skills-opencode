# 05: Glossary entries for Style and Reference

**Spec:** [booking-request-style-and-reference/spec.md](../spec.md)

**What to build:** Two new entries in the project glossary, using the business's own language and free of implementation detail:

- **Style** — the styling the client chooses: *Hijabdo* (styled over a hijab) or *Hairdo* (styled on open hair). A choice, not a description. It is not a Reference: one is the answer, the other is a pointer at what the client means. The word "Model rambut" disappears from the client-facing form, because a Hijabdo is not a model of hair.
- **Reference** — a link, or a short written description, of the look the client wants, sent with a Booking Request.

Follow the existing entries' shape and tone.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Given the glossary, it defines Style as a two-way choice (Hijabdo / Hairdo) and a Reference as a link or short description sent with a Booking Request.
- [x] Given both entries, neither mentions storage, columns, validators, or any implementation detail.
- [x] Given the glossary's existing entries, the two new ones match their format and voice.

## Comments

- 2026-10-18 — Resolved on `feat/booking-request-intake-spec`.
  - Added **Style** and **Reference** to `GLOSSARY.md`, appended after **Headcount**, in domain language only — no schema, columns, validators, or write/read contract, per the spec's vocabulary block and [ADR-0002](../../../docs/adr/0002-booking-request-intake.md).
  - Style is defined as the two-way choice (Hijabdo over a hijab / Hairdo on open hair) and explicitly contrasted with Reference: the answer itself versus a pointer at what the client means. Reference is defined as a link or short written description of the wanted look, sent with a Booking Request.
  - Matched the existing four entries' shape exactly — bold term, colon, plain declarative description wrapped near 80 columns, and an `_Avoid_` line — and kept the same voice: what the term *is*, in the business's language. `_Avoid_` lists the retired client-facing word (`Model rambut`) and its synonym (`hairstyle`) for Style, and the words that would misfile a pointer as the thing itself (`Photo`, `attachment`) for Reference.
  - No code, tests, schema, or ticket graph changed: this is a glossary-only edit, and no test asserts glossary content.
  - Verified: full `vitest run` (445 passed) and `npm run typecheck` clean, matching the previous tickets; the edit is markdown-only and touches no runtime path.
