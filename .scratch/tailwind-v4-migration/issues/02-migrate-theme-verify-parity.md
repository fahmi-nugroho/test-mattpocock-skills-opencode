# 02: Migrate theme to CSS-first and verify parity

**What to build:** the end-to-end behaviour where the same warm elegant look renders again — warm cream page background, deep espresso body text, restrained gold accents, soft gold selection and badge fills, deep gold featured and admin accents, serif display for H1/H2 with sans body, identical featured badge, calendar day colors with selected ring, and unchanged dashboard, login, Indonesian copy, IDR formatting, and WA-first CTAs — verified by a green production build plus a manual visual spot check.

**Blocked by:** 01 (Fix PostCSS plugin move so the build evaluates again).

**Status:** resolved

- [x] Existing palette (warm neutral page, deep espresso text, gold default / deep / soft) plus display and sans font families re-declared as CSS-first theme variables, preserving existing utility class names
- [x] Legacy framework directives replaced with the new major's single import; theme-function lookups replaced with CSS variable references
- [x] Cream background, espresso text, gold accents, badge, calendar ring, and display/sans typography confirmed identical via manual dev-server spot check
- [x] Production build green on Turbopack; no new Vitest seams added
- [x] Legacy JS theme file left in place unmodified; follow-up note recorded for single-source-of-truth removal after green build

## Comments

- Done on branch `integration/tailwind-v4-migration` (commit `feat(02-theme-parity)`).
  `src/app/globals.css` only: `@tailwind base/components/utilities` →
  `@import "tailwindcss"`; palette re-declared in `@theme`
  (`--color-cream/espresso/gold/gold-deep/gold-soft`, same hexes as
  `tailwind.config.js`); font stacks in `@theme inline` so the runtime
  next/font variables keep resolving with the same Georgia / system-ui
  fallbacks; `theme("colors.gold.soft")` → `var(--color-gold-soft)`.
- Verification (build seam per spec): `npm run typecheck` clean;
  `npm run build` (Next 16.4.0, Turbopack) green — all 4 routes
  (`/`, `/admin`, `/admin/login`, `/_not-found`). No `theme(` left in
  output CSS. Compiled production CSS checked:
  `--color-cream:#fdf9f4`, `--color-espresso:#2e2620`,
  `--color-gold:#b45309`, `--color-gold-deep:#92400e`,
  `--color-gold-soft:#f7ead3`;
  `.font-display{font-family:var(--font-display), Georgia, serif}`,
  `.font-sans{font-family:var(--font-sans), ui-sans-serif, system-ui, sans-serif}`;
  `::selection{background:var(--color-gold-soft)}`;
  badge (`bg-gold-soft`/`text-gold-deep`), calendar day colors
  (lime/amber/orange + stone rings) and selected ring
  (`ring-gold-deep`/`ring-offset-cream`) all emitted.
- Manual dev-server spot check: landing + `/admin/login` return 200 with
  `bg-cream font-sans text-espresso` body, `font-display` H1/H2,
  `text-gold` accents, `bg-gold-soft`/`text-gold-deep` badge, and dashboard
  `bg-cream` tabs; served dev CSS carries the same `:root` tokens and
  `font-family: var(--font-display), Georgia, serif`. No component,
  copy, IDR, or WA-link file touched.
- `tailwind.config.js` untouched (verified via `git status`); it is no
  longer read by the build (v4 does not auto-load JS config, no `@config`
  wired — deliberate, see follow-up).
- Follow-up (single source of truth): now that the build is green,
  remove `tailwind.config.js` or formally wire it, so token edits do not
  diverge between the CSS-first `@theme` block and the legacy JS file.
- This green build also satisfies ticket 01's deliberately-deferred
  "production build passes stylesheet evaluation" checkbox.
- `npm run test` still fails at startup (`Cannot find package 'vite'` —
  pre-existing broken test-runner install, out of scope per spec, same
  before/after). No new Vitest seams added.

## Code review (integration branch vs main, two axes)

Standards: 1 judgement call (borderline Divergent Change — `package.json`
mixes the pre-existing Next 14→16 / Vitest 2→5 bump with the Tailwind
migration). Dismissed: the framework/test-runner bump predates this spec
(it is the audit-force accident the spec responds to), not something this
change introduced; splitting it out is out of scope per spec
("test-runner major bump ride along unchanged"). No other smells;
`@theme`/`@theme inline` split and the self-named font vars considered
and cleared (distinct directives; comment names both sides).

Spec: no missing/partial requirements, nothing implemented-but-wrong.
1 scope-creep flag (semantic `tsconfig.json` changes — `jsx:
react-jsx`, `target: ES2017` — beyond pure formatting drift).
Dismissed: `tsconfig.json` is Next-managed (rewritten by dev/build);
reverting fights the framework and the Next 16 upgrade requires it.
Drift rides along per spec. No fix applied.
