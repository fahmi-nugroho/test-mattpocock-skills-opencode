# 06: Admin portfolio prices CRUD

**What to build:** Admin CRUD for Portfolio Items and Price Items including image uploads, so landing content can be managed without code.

**Blocked by:** 02 (tables + buckets), 05 (admin auth guard).

**Status:** resolved

- [x] Portfolio CRUD: image upload to `portfolio/`, title, category (≤6), sort, visible toggle
- [x] Prices CRUD: name, description, price IDR, duration, active, single optional cover upload to `prices/`
- [x] Changes reflect instantly on public landing (03)
- [x] Validation + delete-with-storage-cleanup

## Comments

Resolved on `integration/mua-website` at `81ab67b`. 117/117 Vitest pass, tsc clean, `next build` green. Code-review findings fixed (prune uploaded object when row insert/update fails, category cap counts other rows so shared categories aren't dropped, blank numerics rejected instead of becoming 0).

Deliberate: `revalidate = 0` on the landing so admin edits read live on next load (single route, no per-section ISR); delete storage cleanup is best-effort-silent (row delete already won, orphans prunable); category ≤6 cap is client-side (single-admin model); services `sort` field kept (column exists in schema, public list orders by it).
