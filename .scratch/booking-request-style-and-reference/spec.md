# Spec: Style Choice and Reference on the Format Booking Form

Status: ready-for-agent

## Problem Statement

The client's form asks for the hairstyle in a free-text box. Two problems follow.

First, the artist cannot tell from a written model whether the client wears a hijab, and that single fact decides what she prepares on the day and how long the job takes — styling over a hijab is different work from working on open hair. The answer arrives as prose she has to interpret, and often it does not mention the hijab at all, so the question has to be asked again in the chat the Format Booking link was meant to replace.

Second, a client usually arrives with a look in mind and has nowhere to point at it. The photo they want to send ends up in the WhatsApp thread, separated from the Booking Request it belongs to, which is the same scattering the intake link exists to end.

## Solution

The client's form asks a **Style** as a two-way choice — Hijabdo or Hairdo — in place of the free-text hairstyle box, and it does not let the client send the form without picking one. Beside it, one optional **Reference** field takes a link (or a short written description) of the look the client wants. Both answers land on the Booking Request and travel onto the Booking when the admin accepts it, so what the artist prepares on the day comes from the request itself rather than from chat history.

Photos are not uploaded anywhere: the form says plainly that pictures go through WhatsApp, which is where the client is already talking to the artist. The public form's privacy contract, the occupancy rule, and every money and status rule stay exactly as they were.

## User Stories

**Client**

1. As a client, I want to pick between Hijabdo and Hairdo instead of describing my hair in a text box, so that I can answer in one tap.
2. As a client, I want that choice to be the only styling question I have to answer, so that I do not have to find the right words for my hair.
3. As a client who wears a hijab, I want to say so directly, so that the artist arrives ready to style over a hijab rather than discovering it on the day.
4. As a client, I want to be told inline when I have not picked a style, so that I can fix it before sending.
5. As a client, I want a place to paste a link to a photo of the look I want, so that the artist can see exactly what I mean instead of guessing from my description.
6. As a client, I want to be able to write a short description instead of a link, so that I am not blocked when I have no photo to hand.
7. As a client, I want the reference to be optional, so that I can still send the form when I have nothing to point at.
8. As a client, I want an over-long reference to be refused with a plain message, so that I know to shorten it rather than wondering whether it arrived.
9. As a client, I want the form to tell me that photos go through WhatsApp, so that I do not look for an upload button that is not there.
10. As a client, I want the style and reference to be written in Indonesian and to work on a small screen, so that answering them costs me nothing.
11. As a client, I want everything else about the form to stay exactly as it was, so that the change does not slow me down.

**Admin**

12. As an admin, I want to see whether a client needs Hijabdo or Hairdo at a glance, so that I know what to prepare and how long to budget.
13. As an admin, I want that answer to be one of exactly two values rather than free prose, so that I can rely on it without interpreting it.
14. As an admin, I want the client's reference to be a link I can open, so that I can see the look before the day.
15. As an admin, I want the reference to arrive with the request, so that it does not live in a separate chat thread.
16. As an admin, I want the style and the reference pre-filled onto my booking form when I accept a request, so that I do not retype them.
17. As an admin, I want to see the style and the reference in the Permintaan list, so that I can decide on a request without opening anything.
18. As an admin, I want to see the style and the reference on my Bookings list too, so that I know what to prepare on the day.
19. As an admin, I want the style field on my booking form to be optional, so that I can still create a booking by hand before the client has chosen one.
20. As an admin, I want to change the style on an existing booking, so that a change of plan can be recorded.
21. As an admin, I want the reference on a booking to stay editable, so that I can add what the client told me in chat afterwards.
22. As an admin, I want bookings created before this change to keep whatever was typed in the hairstyle field, so that the new field destroys none of my history.
23. As an admin, I want to keep creating bookings by hand exactly as I do today, so that clients who never use the link are unaffected.
24. As an admin, I want a client to be unable to send a request without a style, so that I never receive work I cannot prepare from.
25. As an admin, I want everything I already do with a request — reading it, accepting it, chasing it — to work unchanged, so that this is an addition and not a rework.

**Quality and safety**

26. As the artist, I want the two-value rule enforced by the same server-side validation that guards every other client field, so that a hand-crafted payload cannot store junk in my database.
27. As the artist, I want the new field capped in length, so that junk cannot reach my database through the public entry point.
28. As the artist, I want the public form's prefill contract unchanged, so that a client's own style and reference are never returned to a stranger holding a link.
29. As the artist, I want the occupancy rule and the money and status rules untouched, so that nothing about this change can move the calendar.
30. As the artist, I want the new columns to be safe on rows that predate them, so that adding them cannot fail or corrupt existing data.

## Implementation Decisions

**Domain vocabulary.** Two terms join `GLOSSARY.md`:

- **Style** — the styling the client chooses: *Hijabdo* (styled over a hijab) or *Hairdo* (styled on open hair). A choice, not a description.
- **Reference** — a link, or a short written description, of the look the client wants, sent with a Booking Request.

A Style is not a Reference: one is the answer, the other is a pointer at what the client means. The word "Model rambut" disappears from the client-facing form, because a Hijabdo is not a model of hair.

**Reuse the existing hairstyle storage rather than adding a column.** The style lives in the column the hairstyle already occupies. That column is unconstrained text today, with `''` meaning "not known", and it has never had a database-level check — its length cap lives in the submit function and the TypeScript validators. The allowed values (`''`, one for Hijabdo, one for Hairdo) are enforced in those same places, not in the schema, because a check there would collide with the free text already stored in existing rows. Retiring the column in favour of a new one would leave it dead but still displayed; reusing it keeps one field with one human-facing meaning.

**Schema change.** One column, on both the request table and the booking table:

- `reference` — text, not null, defaulting to `''`, capped at 300 characters, holding a link or a short description.

No new column is added for the style. No new index, no new constraint, no change to the token bookkeeping columns.

**Public write contract.** The submit function's payload gains one key (`reference`, optional, at most 300 characters) and its existing hairstyle key changes meaning: it is now **required** and must be exactly one of the two Style values. A payload with a missing, empty, or unrecognised style is refused as an invalid payload, exactly as a malformed phone number or an out-of-range headcount is today. The function still writes only the client-owned columns and still sets the submission timestamp.

**Public read contract is unchanged.** The Style and the Reference are client-owned answers, so the read function keeps returning only the admin-supplied name and slot. Nothing new is exposed to a stranger holding a link, and the deliberate stripping of client details stays intact.

**Client form.** The hairstyle text box becomes a required radio group of two options, labelled as the choice rather than as a description, with inline error copy asking the client to pick one. One optional text input takes the Reference, with the same inline error style as the other fields. A short line tells the client that photos go through WhatsApp.

**Admin booking form.** The same two options appear as a radio, but **optional**, so a booking typed by hand can still be saved before a Style is known. The Reference is an optional text input. Both appear in the create form and in the inline row edit, and both are validated by the admin booking validator (empty allowed; a Style that is not one of the two values, or a Reference over 300 characters, is refused with an Indonesian message).

**Accepting a request.** The request-to-booking draft carries the Style and the Reference in addition to the fields it already carries, so accepting pre-fills them onto the booking form. Everything else about accepting is unchanged, and the existing validation and conflict guards still run.

**Displays.** The Permintaan list and the Bookings list both show the Style and the Reference alongside the fields they already show. An empty Reference shows as absent rather than as an empty label.

**Legacy rows.** Existing bookings and requests keep whatever text they hold and display it read-only in the lists. Because the admin's field is a two-option choice, editing such a row cannot re-select that text: the radio comes up unselected and the admin either picks a Style or leaves it empty. This is the accepted cost of reusing the column, and it is why the new field for descriptions is the Reference.

## Testing Decisions

A good test asserts externally visible behaviour only: given a raw public payload, assert the accepted shape or the refusal; given a stored request row, assert the booking-form draft it produces; given a migration file, assert the declared schema. No live database, no component internals, no snapshots.

Three existing seams, no new test infrastructure:

- **Pure validators and mappers.** The public payload validator gains the Style-required rule and the Reference cap, tested with the enum's failure cases (missing, empty, unrecognised) and the cap boundary. The admin booking validator gains the optional-Style rule, tested with an empty value accepted and an unrecognised value refused. The request-to-booking draft mapper is tested for carrying the Style and the Reference. Prior art: the existing payload-validator and draft-mapper tests.
- **Existing test updates.** Every test that constructs a client payload or a request row by hand, and every test asserting an exact validated shape, must be updated deliberately rather than patched — the hairstyle fixture values change meaning, and an unchanged test would assert the old contract. The declarative migration contract test gains the new column on both tables, the new payload key, the Style rule inside the submit function, and the new column in the submit function's SET clause.
- **No new seam for the forms.** The client form and the admin form remain covered by manual QA, as every other screen in this repo is; the validation rules they depend on are the pure validators above.

## Out of Scope

- Uploading photos, attachments of any kind, client-side file inputs, or any new storage bucket or public upload path. Photos keep going through WhatsApp.
- More than two Styles, per-style pricing or duration, or a Style record of its own.
- Separate reference fields per aspect (one for makeup, one for hair, one for hijab). One Reference field only.
- Migrating the free text already stored in the hairstyle column, and adding a database-level check on it.
- Making the admin's Style field required, or back-filling a Style onto existing bookings.
- Any change to the public read function, the token rules, the occupancy rule, the Booking lifecycle, or the money fields.
- Replacing the Approximate/clash warning, the form's states, or its copy beyond the two new fields.

## Further Notes

- Build order: (1) migration plus submit function plus types, with the declarative contract test; (2) both validators and the draft mapper, with their tests; (3) the client form's radio and reference input; (4) the admin booking form's radio and reference in create, edit, and both list displays; (5) the two `GLOSSARY.md` entries.
- Glossary terms this creates: **Style** and **Reference**. Both entries must stay free of implementation detail.
- No ADR is needed. This adds an enumerated answer to an existing intake flow; it introduces no new architecture, no new public surface, and no reversal of an earlier decision. It sits inside [ADR-0002](../../docs/adr/0002-booking-request-intake.md) unchanged: a Booking Request remains the client's own answer, never a commitment, and never carrying a price.
- Where this touches the intake spec: it narrows one client field from free text to a choice, and it grows the client's form from ten inputs to twelve. The intake spec's out-of-scope line forbidding attachments still holds.
- The installations of `hairdo` in code and copy are numerous — two schema columns, the submit function, two TypeScript types, two validators, the form's field state, both managers, and eight test files. They all change together, which is why this feature is deliberately separate from the Permintaan list work.
- Tickets for this feature live at `.scratch/booking-request-style-and-reference/issues/`.
