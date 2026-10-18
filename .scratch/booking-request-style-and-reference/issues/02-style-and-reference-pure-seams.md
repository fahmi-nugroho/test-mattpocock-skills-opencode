# 02: Style and Reference across the pure seams

**Spec:** [booking-request-style-and-reference/spec.md](../spec.md)

**What to build:** The pure, externally testable rules that both the client form and the admin form depend on, with no React and no database.

- The public payload validator makes the Style **required** and exactly one of the two values (`hijabdo` / `hairdo`), with plain Indonesian copy; the missing, empty, and unrecognised cases each fail. Its Reference rule is optional and capped at 300 characters, failing with a plain Indonesian message over the cap.
- The admin booking validator makes the Style **optional** — empty is allowed (a booking typed by hand may predate the client's choice) — but any value that is not one of the two is refused with an Indonesian message, as is a Reference over 300 characters.
- The request-to-booking draft mapper carries the Style and the Reference in addition to the fields it already carries, so accepting a request can pre-fill them onto the booking form.

Every existing test that hand-builds a client payload or a request row, and every test asserting an exact validated shape, is updated deliberately rather than patched: the fixture values in the reused column change meaning, so an unchanged test would assert the old contract. New boundary tests cover each of the rules above at the enum's failure cases and at the 300-character cap.

**Blocked by:** 01

**Status:** resolved

- [x] Given the public payload validator, a missing Style is refused, an empty Style is refused, and a Style that is neither `hijabdo` nor `hairdo` is refused — each with its own Indonesian message.
- [x] Given the public payload validator, a valid Style passes and an absent Reference passes.
- [x] Given a Reference of exactly 300 characters the public payload validator accepts it; at 301 it is refused with a plain Indonesian message.
- [x] Given the admin booking validator, an empty Style is accepted and a Style that is neither value is refused in Indonesian.
- [x] Given the admin booking validator, a Reference over 300 characters is refused in Indonesian.
- [x] Given a stored request row, the request-to-booking draft carries its Style and Reference.
- [x] Given the updated test fixtures, they assert the new contract rather than the old one.

## Comments

- 2026-10-18 — Resolved on `feat/booking-request-intake-spec`.
  - Feature commit `9931d5f`.
  - The public `validateBookingRequestPayload` requires the Style (untrimmed, exactly `hijabdo`/`hairdo`), with distinct Indonesian copy for missing (`wajib dipilih`), empty (`tidak boleh kosong`), and unrecognised (`tidak valid`); the optional Reference is trimmed and capped at 300.
  - The admin `validateBookingInput` keeps the Style optional (`''` allowed) but refuses any other value, and caps the Reference at 300 — the required/optional split is the only difference from the public rule.
  - `requestToBookingDraft` adds `reference` beside the Style it already carried, so accepting pre-fills both.
  - The two-value set and the 300 cap live once in the new pure `src/lib/style-reference.ts`, shared by both validators and mirroring `0017_style_and_reference.sql`; no new test seam was added.
  - Deliberately updated the fixtures that hand-build a client payload or a request/booking row (`booking-request.test.ts`, `booking-request-rpc.test.ts`, `validate-booking.test.ts`, `booking-request-admin.test.ts`, `admin-requests.test.ts`, `admin-bookings.test.ts`) rather than patching assertions.
  - Code review (standards + spec axes): no hard violations. Two accuracy fixes applied — a test name that overclaimed an absent-Reference default, and a docstring that said the admin rule "matched" the public one. Both axes' remaining points were judgement calls (keeping the reused `hairdo` key, narrowing the admin type, bundling Style+Reference) left to later tickets.
