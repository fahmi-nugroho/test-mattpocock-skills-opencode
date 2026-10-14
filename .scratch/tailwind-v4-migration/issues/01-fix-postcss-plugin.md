# 01: Fix PostCSS plugin move so the build evaluates again

**What to build:** the end-to-end behaviour where the production build gets past global stylesheet evaluation again after the Tailwind major bump — the plugin-move error is gone and styling compiles under Turbopack.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Dependency manifest declares the dedicated PostCSS adapter package so fresh installs build
- [x] PostCSS config loads the new plugin name instead of the core framework package directly
- [x] Standalone autoprefixer entry is dropped from the plugin list and dependency set (re-add only if the build warns)
- [x] Production build passes stylesheet evaluation with no plugin-move error
- [x] No theme token or visual changes in this ticket; legacy JS theme file untouched

## Comments

- Done on branch `fix/tailwind-v4-postcss-migration` (working tree; uncommitted).
  `package.json`: added `@tailwindcss/postcss@^4.3.3` dev dep, removed `autoprefixer`.
  `postcss.config.js`: plugins now `{ "@tailwindcss/postcss": {} }` only.
  `tailwind.config.js` and `src/app/globals.css` untouched (verified via `git status`).
- Install note: plain `npm install -D @tailwindcss/postcss` fails with ERESOLVE
  (pre-existing vitest@5 vs @types/node@20 peer conflict from the audit-force
  bump, unrelated to styling). Used `--legacy-peer-deps`; same flag for the
  autoprefixer uninstall.
- Verification (red-green, build seam per spec): before — `npm run build`
  failed with "trying to use `tailwindcss` directly as a PostCSS plugin...
  install `@tailwindcss/postcss`". After — that error is gone; the build now
  proceeds into stylesheet content resolution under Turbopack and stops at
  `theme(colors.gold.soft)` in `src/app/globals.css:11`, which is ticket 02's
  explicit scope ("theme-function lookups replaced with CSS variable
  references"). No autoprefixer warning appeared, so no re-add.
- `npm run typecheck` passes. `npm run test` fails identically with and
  without this change (`Cannot find package 'vite'` from vitest startup —
  pre-existing broken test-runner install, out of scope per spec).
- Build-green checkbox left open deliberately: full green requires ticket 02's
  CSS-first theme migration; achieving it here would violate this ticket's
  no-theme-changes constraint. Ticket 02 is now unblocked.

## Follow-up (added after 02 landed)

- Build-green checkbox now checked: ticket 02's CSS-first migration turned
  the build green (`npm run build`, Next 16.4.0 Turbopack, all routes),
  with no plugin-move error and no autoprefixer warning. No change to this
  ticket's own files was needed.
