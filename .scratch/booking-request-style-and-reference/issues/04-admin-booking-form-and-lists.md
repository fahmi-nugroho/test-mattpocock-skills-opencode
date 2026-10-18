# 04: Admin booking form and both lists — Style and Reference

**Spec:** [booking-request-style-and-reference/spec.md](../spec.md)

**What to build:** The admin-facing half of the feature. The same two options appear on the admin booking form as a radio, but **optional**, so a booking typed by hand can still be saved before a Style is known; the Reference is an optional text input. Both appear in the create form and in the inline row edit, and both are validated by the admin booking validator (empty allowed; a Style that is neither value, or a Reference over 300 characters, is refused with an Indonesian message).

Accepting a request pre-fills the Style and the Reference onto the booking form, so the admin does not retype them; everything else about accepting is unchanged and the existing validation and conflict guards still run.

The Permintaan list and the Bookings list both show the Style and the Reference alongside the fields they already show, so the admin can decide on a request and prepare for a booking without opening anything. An empty Reference shows as absent rather than as an empty label. Existing rows keep whatever text they hold in the reused column and display it read-only: because the field is a two-option choice, editing such a row cannot re-select the old text — the radio comes up unselected and the admin either picks a Style or leaves it empty.

**Blocked by:** 02

**Status:** resolved

- [x] Given the admin create form, the Style is an optional two-option radio and the Reference is an optional input.
- [x] Given the admin saves a booking with no Style chosen, it saves.
- [x] Given the admin picks a Style and adds a Reference, both are stored.
- [x] Given the admin submits a Style that is neither value, or a Reference over 300 characters, it is refused in Indonesian.
- [x] Given the admin edits an existing booking inline, the same optional radio and Reference input are available and save.
- [x] Given the admin accepts a request, the booking form is pre-filled with the request's Style and Reference.
- [x] Given the Permintaan list, each row shows the Style and the Reference (absent when empty).
- [x] Given the Bookings list, each row shows the Style and the Reference (absent when empty).
- [x] Given a booking or request made before this change, its stored text still shows, read-only, and editing it leaves the radio unselected unless the admin picks a Style.
- [x] Given a client who never uses the link, the admin can still create a booking by hand exactly as before.

## Comments

- 2026-10-18 — Resolved on `feat/booking-request-intake-spec`.
  - Feature commit `52312be`; review fix `f285738`.
  - Replaced the `Model rambut` text field with an optional `Gaya rambut` two-option radio and an optional `Referensi` input in `BookingsManager`'s create form and inline row edit. Both feed `validateBookingInput`, whose optional-Style rule and 300-char Reference cap were already in place from ticket 02; the Indonesian refusals surface through the form's existing `formError` / `rowError` alert.
  - Moved the radio label/description copy into `STYLE_COPY` in `src/lib/style-reference.ts` (the single two-value home), so the client form (ticket 03) and both admin surfaces cannot drift. The admin radios render from `STYLE_VALUES`.
  - Accept prefill now carries the Reference (`setReference(draft.reference)`) alongside the Style it already set. Review caught that a legacy request's free text cannot seed a two-option radio: accepting one used to write unrecognised text into the field and refuse the save. It is now normalised to `""` (radio unselected) with the old text shown read-only ("Teks gaya lama (hanya baca): …"), mirroring `startEdit` for legacy bookings.
  - A new shared `StyleReferenceFacts` component renders `Gaya:` / `Referensi:` in both the Permintaan list and the Bookings list, hiding an empty Reference and the whole line when both are empty. A legacy value shows its stored text read-only; a known value shows its label.
  - Code review (standards + spec axes): the spec axis caught the legacy-accept bug above; the standards axis flagged duplicated list-display logic, fixed with `StyleReferenceFacts`. Two points left as judgement calls: the `Gaya:` label on a legacy value's stored text (the column's human-facing meaning is now the Style, per the spec's column-reuse decision), and no "clear the Style" affordance once a radio is picked (the spec's field is exactly two options, and an unset initial state is what "optional" requires).
  - Verified: `npm run typecheck`, full `vitest run` (445 passed), and `npm run build` all clean. Manual QA on the forms remains their coverage, per the spec.
