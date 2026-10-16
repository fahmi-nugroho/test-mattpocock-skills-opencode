# 02: Testimoni end-to-end

**What to build:** Admin can curate the client review list and clients see the latest list on the landing, with the old hardcoded list as fallback when nothing is curated yet.

**Blocked by:** 01 (schema foundation for Profil & Testimoni).

**Status:** ready-for-agent

- [ ] New "Profil & Testimoni" section in the existing admin dashboard with a testimonials manager following the same UX pattern as the existing portfolio/services managers (add, edit, hide/show, delete with confirm, sort order)
- [ ] Pure input validation for quote (required, max 300 chars) and client name (required), sort integer >= 0, with clear Indonesian error messages
- [ ] At most 6 visible testimonials render on the public landing in sort order; hidden ones never render publicly
- [ ] When no visible testimonials exist, landing falls back to the existing hardcoded list so the section never appears blank
- [ ] Unit tests cover validator behavior, visible-only ordered public read, and empty-list fallback (mocked data layer, no live DB)
