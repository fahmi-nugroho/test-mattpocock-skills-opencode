# 02: Testimoni end-to-end

**What to build:** Admin can curate the client review list and clients see the latest list on the landing, with the old hardcoded list as fallback when nothing is curated yet.

**Blocked by:** 01 (schema foundation for Profil & Testimoni).

**Status:** resolved

- [x] New "Profil & Testimoni" section in the existing admin dashboard with a testimonials manager following the same UX pattern as the existing portfolio/services managers (add, edit, hide/show, delete with confirm, sort order)
- [x] Pure input validation for quote (required, max 300 chars) and client name (required), sort integer >= 0, with clear Indonesian error messages
- [x] At most 6 visible testimonials render on the public landing in sort order; hidden ones never render publicly
- [x] When no visible testimonials exist, landing falls back to the existing hardcoded list so the section never appears blank
- [x] Unit tests cover validator behavior, visible-only ordered public read, and empty-list fallback (mocked data layer, no live DB)

## Comments

2026-10-16 — Implemented and merged on integration branch
`feat/profile-testimoni-admin-spec` (merges `8f78e85`, `64400e6`,
feat `0f2ed30`, review fix `ade5b1b`). Testimonials manager +
`validate-testimonial.ts` + `admin-testimonials.ts` + landing fallback
(`resolveDisplayedTestimonials`, max 6, hidden excluded, empty →
hardcoded `TESTIMONIALS`). Verified: 41 test files / 281 tests pass,
`tsc --noEmit` clean. Review fixes: id-first React keys, defensive
sort in resolver, `filteredItems` rename, dead `notice` removed.
Deferred to ticket 03: profile form + stats manager (section currently
hosts testimonials only).
