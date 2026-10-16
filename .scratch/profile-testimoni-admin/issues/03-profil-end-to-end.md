# 03: Profil end-to-end (headline, subcopy, portrait, stats)

**What to build:** Admin can edit the full hero profile (tagline, description, portrait photo, achievement stats) and clients see the latest profile on next landing load, with existing hardcoded content and portfolio-cover portrait as fallback.

**Blocked by:** 01 (schema foundation for Profil & Testimoni).

**Status:** resolved

- [x] Admin profil form edits headline (max 120 chars), subcopy (max 300 chars), and portrait (upload with preview plus manual HTTPS URL paste) with clear validation errors
- [x] Portrait replace and remove cleans up the previous stored object best-effort so storage does not leak; empty portrait falls back to the first portfolio cover, then to the existing placeholder state
- [x] Stats manager supports add/edit/hide/delete plus sort order, max 4 visible stats on landing, value/label each max 40 chars
- [x] Public hero renders live headline, subcopy, portrait, and stats in sort order; when settings/stats are empty it falls back to the existing hardcoded headline, copy, stats, and portrait behavior
- [x] Unit tests cover profil and stat validators, portrait fallback resolution, and visible-only ordered stats read (mocked data layer, no live DB)

## Comments

2026-10-16 — Implemented and merged on integration branch
`feat/profile-testimoni-admin-spec` (merges `339c512`, `03cfb55`,
feat `9835578`, review fix `1be7393`). Profile form +
`validate-profile.ts` + `validate-stat.ts` + `admin-profile-stats.ts` +
stats manager + `get_public_profile` RPC (0014) + `public-profile.ts` +
landing fallback (`resolveDisplayedStats` max 4, portrait DB → env →
portfolio cover → placeholder). Verified: 48 test files / 326 tests
pass, `tsc --noEmit` clean. Review fixes: RPC array-shape unwrap
(RETURNS TABLE returns array via supabase-js), validation order (stale
manual URL no longer blocks file upload), portrait whitespace reject,
shared `resolveVisibleOrdered` + `settledValue` helpers. Note: extends
`Settings` with headline/subcopy/portrait_url per spec, superseding the
wa-only note in ADR-0001 §Decision for this table. Deferred:
admin-testimonials/stats generic-module dedup, portrait content-type
check (whitespace-only for manual URLs; uploads via checkImageFile).
