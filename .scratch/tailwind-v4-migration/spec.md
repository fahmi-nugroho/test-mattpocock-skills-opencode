## Problem Statement

As a developer running install, I see critical vulnerability warnings, so I run audit fix with force. After that the production build fails while evaluating the global stylesheet, telling me I am using Tailwind directly as a PostCSS plugin and must move to a separate package. The landing and dashboard no longer build, so clients and admin see nothing.

## Solution

Stay on the already-bumped major versions and migrate the styling stack forward to the new Tailwind major: switch the PostCSS configuration to the dedicated PostCSS package, move the design tokens to the CSS-first theme format, and update the global stylesheet directives so the same warm elegant look renders again. The legacy JS theme config stays in the repo untouched until the build is green, so there is a single visible source of truth at each step.

## User Stories

1. As a developer with criticals on install, I want audit fix with force to clear them, so that dependencies are secure.
2. As a developer after the bump, I want the production build to pass on Turbopack, so that I can ship again.
3. As a developer, I want a clear error-to-fix mapping for the PostCSS plugin move, so that I do not guess at config.
4. As a developer, I want the dependency manifest to declare the dedicated PostCSS package, so that fresh installs build.
5. As a developer, I want the PostCSS config to load the new plugin name, so that stylesheet evaluation succeeds.
6. As a developer, I want no double autoprefixing, so that output CSS stays predictable.
7. As a client on mobile, I want the warm cream page background to still render, so that the brand feels calm.
8. As a client, I want deep espresso body text to still render, so that copy stays legible.
9. As a client, I want the restrained gold accent on headings and badges to still render, so that premium cues survive.
10. As a client, I want the soft gold selection and badge fills to still render, so that highlights look intentional.
11. As a client, I want deep gold text on featured and admin accents to still render, so that hierarchy is preserved.
12. As a client, I want serif display for H1/H2 and sans body to still load, so that typography is unchanged.
13. As a client browsing prices, I want the featured badge to look identical to before, so that choice guidance is stable.
14. As a client viewing the calendar, I want Tersedia / Penuh / Tutup day colors and selected ring to look identical, so that availability meaning is unchanged.
15. As an admin, I want the dashboard tabs, lists, and login styling to look identical, so that operations are not disrupted.
16. As an owner, I want Indonesian copy, IDR formatting, and WA-first CTAs visually unchanged, so that conversion flow is untouched.
17. As a developer, I want the legacy JS theme config left in place during migration, so that rollback comparison is easy.
18. As a future maintainer, I want a single theme source of truth after migration, so that token edits do not diverge.

## Implementation Decisions

- Stay on the bumped majors, migrate forward: the audit-driven upgrades to the app framework, styling framework, and test runner are kept; no downgrade to the old styling major.
- PostCSS integration: declare the dedicated PostCSS adapter package as a dev dependency and point the PostCSS plugin list at it instead of the core framework package.
- Prefix handling: drop the standalone autoprefixer entry from the plugin list and dependency set, since the new major handles prefixing internally; re-add only if the build warns.
- Theme tokens migration: re-declare the existing palette (warm neutral page, deep espresso text, gold default / deep / soft) plus display and sans font families as CSS-first theme variables in the global stylesheet, preserving existing utility class names.
- Stylesheet syntax migration: replace legacy framework directives with the new major's single import, and replace theme-function lookups with CSS variable references.
- Legacy config fate: leave the legacy JS theme file in the repo unmodified during the fix to minimize risk; removal or formal wiring is a follow-up once the build is green.
- Dependency drift isolation: framework config formatting drift and test-runner major bump ride along unchanged; no framework codemod or test rewrite in this fix.
- No ADR conflict: the operating-hours removal decision is untouched; day-status semantics and WA-first flow are preserved as-is.

## Testing Decisions

- Good test = external behavior only: build passes, same utility classes resolve to same colors and fonts in output CSS. No unit assertions on config internals or snapshots.
- Single highest seam: production build with Turbopack exercises PostCSS plus styling plus framework together; this is the only required seam.
- No new unit seams: existing Vitest suites cover WA links, portfolio filter, availability derivation, and formatting — none cover styling, and no new pure function is introduced, so no unit file is added.
- Visual parity check: manual dev-server spot check of cream background, espresso text, gold accents, badge, calendar ring, and display/sans typography against pre-bump look.
- Prior art: prior green-build evidence pattern from the polish effort (Vitest pass plus typecheck plus production build green) is reused for the verification signal, scoped here to build green as the gate.

Agreed seam with user: build seam only (Recommended) — production build green, plus manual visual parity, no new Vitest seams. Please confirm this seam matches your expectation; I proceeded with it in this spec.

## Out of Scope

- Downgrading the styling framework to the old major.
- Framework migration beyond styling (routing, caching, codemods for the app-framework major bump).
- Test-runner migration fixes beyond keeping the existing suite running.
- Framework config formatting drift beyond styling.
- New booking flow, payments, schema migration, auth or RLS changes.
- Full rebrand, new UI library, component snapshot or E2E tests.
- Removal of the legacy JS theme file (follow-up after green build).

## Further Notes

- Grilling consensus: audit fix intent was clearing install criticals, bump was accidental; direction is stay on new major; done signal is production build green.
- Blast radius from the force fix: app framework 14.x to 16.x, styling framework 3.x to 4.x, test runner 2.x to 5.x, plus formatter-driven config reshaping.
- The reported failure is stylesheet evaluation via the PostCSS transform under Turbopack surfacing the plugin-move error.

Status: ready-for-agent
