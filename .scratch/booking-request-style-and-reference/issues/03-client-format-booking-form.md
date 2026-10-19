# 03: Client Format Booking form — Style radio and Reference input

**Spec:** [booking-request-style-and-reference/spec.md](../spec.md)

**What to build:** The client-facing change on the public Format Booking form. The `Model rambut` text box becomes a **required** two-option radio — Hijabdo (styled over a hijab) and Hairdo (styled on open hair) — labelled as the choice rather than as a description, with inline error copy asking the client to pick one when they try to send without a Style. Beside it, one **optional** text input takes the Reference (a link or a short written description of the look the client wants), with the same inline error style as the other fields and a plain message if it is too long. A short line tells the client that photos go through WhatsApp, so they do not look for an upload button that is not there. Both new fields are in Indonesian and work on a small screen. Everything else about the form — its other fields, the slot, the clash warning, the states, the money and status rules — stays exactly as it was.

The rules the radio and the input enforce come from the pure validator in ticket 02; this ticket only renders and wires them.

**Blocked by:** 02

**Status:** resolved

- [x] Given the form is open, the styling question is a two-option choice (Hijabdo / Hairdo), not a text box.
- [x] Given the client tries to send without picking a Style, an inline Indonesian error names the field and nothing is submitted.
- [x] Given the client picks a Style and sends, the request is stored with that Style.
- [x] Given the client leaves the Reference blank, the form still sends.
- [x] Given the client enters a Reference under the cap, it is stored with the request; over the cap it is refused inline in Indonesian.
- [x] Given the form, a line tells the client that photos go through WhatsApp.
- [x] Given a small screen, both new fields are usable and the copy is Indonesian.
- [x] Given the rest of the form, every other field and behaviour is unchanged.

## Comments

- 2026-10-18 — Resolved on `feat/booking-request-intake-spec`.
  - Replaced the `Model rambut` text box in `src/components/request-form.tsx` with a required `<fieldset>` radio group (`Gaya rambut`), its two options driven by the ticket-02 `STYLE_VALUES`/`Style` seam so the values cannot drift from the validator; each option shows the choice plus its over-hijab / open-hair description.
  - Added the optional `Referensi` text input directly after it, with the WhatsApp photos line beneath. No `maxLength` on the input, so an over-cap value reaches the validator and is refused inline in Indonesian (`Referensi maksimal 300 karakter`) rather than being silently truncated.
  - Grew `BookingRequestFormFields`/`EMPTY_REQUEST_FORM` in `src/lib/booking-request-form.ts` with `reference`, and updated the existing pure seam test (`booking-request-form.test.ts`) accordingly. No new test seam was added, per the spec.
  - The Style and Reference errors surface through the form's existing single inline alert, which is the mechanism every other field already uses — so the ticket's "same inline error style as the other fields" is met and the other fields' behaviour is untouched. The radio is deliberately not marked native `required`, which would show a browser-localised message instead of the Indonesian copy.
  - Code review (standards + spec axes): no hard violations, no missing requirements, no scope creep. The one fix applied was deriving the radio options from `STYLE_VALUES` instead of re-typing the two values (a drift risk both axes flagged). Remaining points were judgement calls left as-is: the `hairdo` storage key kept per the column-reuse decision, the raw `string` field type kept per the form's controlled-input convention, and the `Gaya rambut` legend kept to match ticket 02's validator copy.
  - Verified: `npm run typecheck`, full `vitest run` (445 passed), and `npm run build` all clean. Manual QA on a small screen remains the form's own coverage, per the spec.
