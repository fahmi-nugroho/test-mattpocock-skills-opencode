# 07: Edit the payment details once

**What to build:** The Pengaturan section gains bank name, account name, account number and Instagram handle, loaded with the existing WhatsApp number and saved with the same button. Saving normalises the Instagram handle without a leading `@` and reduces the account number to digits, while the existing WhatsApp number rules stay unchanged. Any of the four may be saved empty — the invoice then prints an em dash — so the admin is never blocked from saving the rest.

**Blocked by:** 01.

**Status:** resolved

- [x] The settings read and form carry the four fields and persist them on the single settings row with the existing save action.
- [x] Validation normalises the Instagram handle without a leading `@` and the account number to digits, with tests.
- [x] The existing WhatsApp number validation and error message are unchanged.
- [x] Empty values are accepted and saved, and the invoice falls back to an em dash.
- [x] Saved values survive a reload and are what the invoice picture prints.

## Comments

- 2026-10-21 — Resolved on `feat/invoice-and-booking-filter-spec`.
  - `validate-settings.ts` now validates the WA number (unchanged rules and message) plus four optional printables: bank name, account name, account number and Instagram handle. Names trim, the account number reduces to digits, and the handle loses a leading `@` and blanks. Empty stays empty. Input is `SettingsInput` (optional printables); output is the fully-populated `ValidatedSettingsInput`.
  - Extracted `src/lib/instagram.ts` (`normaliseInstagramHandle`) so the settings form and the Invoice picture share one handle rule instead of two divergent copies; `invoice-layout.ts` now imports it.
  - `updateSettings` persists all five values on row id = 1, including `''`, so an unconfigured field reaches the picture and prints an em dash rather than blocking the save.
  - `admin-dashboard.tsx` carries the four fields in state, loads them with the existing WA read, and saves them through the one button. The four inputs are not `required`; only the WA number keeps its existing guard.
  - Tests: `instagram.test.ts` (3) for the shared handle rule, `validate-settings.test.ts` (9) for the four-field contract, normalisation and unchanged WA refusals, and `admin-settings.test.ts` for the five-column payload, empty payment details and the read carrying the fields. `npm run typecheck` clean; full `vitest run` (590 passed).
  - Docs: added a partial-supersede note to ADR-0001, whose "settings form carries `wa_number` only" clause this ticket deliberately changes.
  - Code review (standards + spec axes). Fixed: shared Instagram rule, raw/validated input type split, read-side assertion, Instagram placeholder no longer teaches the stripped `@`. Deliberately unchanged: the spec's seeding line conflicts with ticket 01's recorded "seeded empty" decision; the four near-identical field blocks follow the repo's inline-Tailwind convention.
