# 05: Give the admin routes their own tab titles

**What to build:** The dashboard and the login page each get their own browser-tab title, composed with the business name through the root template. Both routes are client components today, and a client component cannot export metadata, so each is split the way the public Format Booking route already is: a thin server page exporting the route's title that renders the existing client component unchanged. The auth guard, the session redirect, and the sign-in handling move across without changing behaviour.

**Blocked by:** 04 — the route titles are composed with the business name through the template that ticket introduces.

**Status:** resolved

- [x] The dashboard tab reads "Dashboard Admin"; the login tab reads "Login Admin"; both compose with the business name through the root template, and a client's Format Booking tab reads "Format Booking".
- [x] Each admin route is a server page that exports its metadata and renders the client component holding the existing markup and logic.
- [x] The dashboard's browser-session guard and its redirect to the login page behave exactly as before.
- [x] The login page's session check, its redirect to the dashboard when a session exists, and its sign-in error mapping behave exactly as before.
- [x] No component's rendered markup changes as a result of the split; the only new artifact per route is the metadata export.
- [x] `npm run typecheck`, the full test suite, and a production build all pass.

## Comments

- 2026-10-19 — Implemented on `feat/form-layout-polish-spec`.
  - `src/app/admin/page.tsx` and `src/app/admin/login/page.tsx` are now thin server pages exporting `metadata` with the titles `"Dashboard Admin"` and `"Login Admin"`. The root template renders them as `Dashboard Admin · Wandana Makeup` and `Login Admin · Wandana Makeup`.
  - The existing dashboard and login code moved unchanged to `src/components/admin/admin-dashboard.tsx` (`AdminDashboard`) and `src/components/admin/admin-login.tsx` (`AdminLogin`); only the export/function names changed. The auth guard, session redirects, sign-in handling, error mapping, and all JSX are identical to their previous versions.
  - `src/app/request/[token]/page.tsx` now exports `metadata.title = "Format Booking"`, rendering as `Format Booking · Wandana Makeup`; the page and form markup are untouched.
  - `README.md`'s project-structure tree now reflects the server routes and the two moved client components.
  - No new tests: the change has no pure logic seam (the spec's Testing Decisions forbid React-rendering and snapshot tests), and behaviour is covered by the existing suite.
  - Verified: `npm run typecheck` clean, full `vitest run` (55 files, 491 passed), `npm run build` succeeds. Rendered titles confirmed in the build output and against the running dev server.
  - Code review (standards + spec axes) found no hard violations and no spec gaps; the only finding, the stale README tree, was fixed.

