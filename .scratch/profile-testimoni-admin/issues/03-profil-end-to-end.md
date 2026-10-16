# 03: Profil end-to-end (headline, subcopy, portrait, stats)

**What to build:** Admin can edit the full hero profile (tagline, description, portrait photo, achievement stats) and clients see the latest profile on next landing load, with existing hardcoded content and portfolio-cover portrait as fallback.

**Blocked by:** 01 (schema foundation for Profil & Testimoni).

**Status:** ready-for-agent

- [ ] Admin profil form edits headline (max 120 chars), subcopy (max 300 chars), and portrait (upload with preview plus manual HTTPS URL paste) with clear validation errors
- [ ] Portrait replace and remove cleans up the previous stored object best-effort so storage does not leak; empty portrait falls back to the first portfolio cover, then to the existing placeholder state
- [ ] Stats manager supports add/edit/hide/delete plus sort order, max 4 visible stats on landing, value/label each max 40 chars
- [ ] Public hero renders live headline, subcopy, portrait, and stats in sort order; when settings/stats are empty it falls back to the existing hardcoded headline, copy, stats, and portrait behavior
- [ ] Unit tests cover profil and stat validators, portrait fallback resolution, and visible-only ordered stats read (mocked data layer, no live DB)
