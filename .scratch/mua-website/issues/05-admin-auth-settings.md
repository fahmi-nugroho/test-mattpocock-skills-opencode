# 05: Admin auth overview settings

**What to build:** Private admin area with email+password login, today/upcoming overview, and operating settings editing, so the artist controls WA number and hours.

**Blocked by:** 02 (needs settings table + auth RLS).

**Status:** resolved

- [x] `/admin/login` single-admin email+password via Supabase Auth, `/admin` guarded
- [x] Overview shows today + upcoming Booking counts (confirmed/pending)
- [x] Settings form edits wa_number, open/close hour, persists and reflects in calendar derivation
- [x] No public signup exposed

## Comments

Resolved on `integration/mua-website` at `65b7893`. 80/80 Vitest pass, tsc clean, `next build` green. Code-review findings fixed (removed overview `.limit()` silent truncation, `settingsReady` guard so a failed settings load can't be overwritten with defaults).

Deliberate: browser-session guard (no `@supabase/ssr`, no `middleware.ts`) — clients created inside effects/handlers so prerender never touches env vars; single-admin = any authenticated session per `0002_rls.sql`, account created manually, no signup UI exposed.
