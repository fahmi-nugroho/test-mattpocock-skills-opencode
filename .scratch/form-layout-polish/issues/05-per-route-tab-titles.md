# 05: Give the admin routes their own tab titles

**What to build:** The dashboard and the login page each get their own browser-tab title, composed with the business name through the root template. Both routes are client components today, and a client component cannot export metadata, so each is split the way the public Format Booking route already is: a thin server page exporting the route's title that renders the existing client component unchanged. The auth guard, the session redirect, and the sign-in handling move across without changing behaviour.

**Blocked by:** 04 — the route titles are composed with the business name through the template that ticket introduces.

**Status:** ready-for-agent

- [ ] The dashboard tab reads "Dashboard Admin"; the login tab reads "Login Admin"; both compose with the business name through the root template, and a client's Format Booking tab reads "Format Booking".
- [ ] Each admin route is a server page that exports its metadata and renders the client component holding the existing markup and logic.
- [ ] The dashboard's browser-session guard and its redirect to the login page behave exactly as before.
- [ ] The login page's session check, its redirect to the dashboard when a session exists, and its sign-in error mapping behave exactly as before.
- [ ] No component's rendered markup changes as a result of the split; the only new artifact per route is the metadata export.
- [ ] `npm run typecheck`, the full test suite, and a production build all pass.

## Comments
