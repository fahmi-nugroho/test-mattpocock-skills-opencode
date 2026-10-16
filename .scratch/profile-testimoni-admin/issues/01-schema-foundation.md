# 01: Schema foundation for Profil & Testimoni

**What to build:** Migrated database that can store admin-editable Profil and Testimoni, with public-read / admin-write access enforced, so later UI slices have somewhere to read and write.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

## Comments

2026-10-16 — Implemented and merged on integration branch
`feat/profile-testimoni-admin-spec` (merge `bf0000a`, feat `f8440cd`,
review fix `96c2baf`). Migration `0013_profile_testimoni_schema.sql`
(settings headline/subcopy/portrait_url with https+length checks,
`testimonials` + `profile_stats` with sort/visible + indexes, anon
visible-only / authenticated full CRUD RLS, public `profile` bucket);
`database.ts` types + `getVisibleTestimonials`/`getVisibleProfileStats`
via ordered-public-list seam; landing untouched (hardcoded fallback
holds on empty tables). Verified: 38 test files / 261 tests pass,
`tsc --noEmit` clean. Review fix: portrait_url now requires `https://`
prefix per spec #44. Deferred to tickets 02/03: display caps, landing
loader, admin validators, settings public-read helper.

- [ ] Settings single row gains headline, subcopy, portrait URL columns with sensible defaults and length checks
- [ ] New testimonials collection (quote, client name, sort order, visible flag) with sort and visibility indexes
- [ ] New profile stats collection (value, label, sort order, visible flag) with sort and visibility indexes
- [ ] Anonymous role can only read visible testimonials and stats; authenticated admin role has full CRUD on both plus settings update
- [ ] Portrait image storage is publicly readable and writable only by authenticated admin (reuse existing public bucket pattern or add a profile bucket consistently)
- [ ] Migration applies cleanly on a fresh database and landing still renders via existing hardcoded fallback when new tables are empty
