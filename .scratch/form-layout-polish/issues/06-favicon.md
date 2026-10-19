# 06: Give the app an icon

**What to build:** The app gets its first icon, supplied through the app router's file convention so no manifest and no build dependency are added. The mark is the business's initial — a serif W in cream on the espresso tile, so it stays legible at tab size on both light and dark browser chrome. It is a vector file, hand-editable, and the only icon: no bitmap fallback, no apple touch icon, no manifest.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] An icon file is served through the app router's convention, with no manifest, no bitmap, and no new project dependency.
- [x] The mark is a serif W in cream on the espresso tile, drawn as vector paths or text in a generic serif stack (a document icon cannot load the app's display font).
- [x] The mark is legible at 16px and 32px: the letter reads as a W, does not touch the tile edge, and keeps its contrast against both light and dark browser chrome.
- [x] A browser tab, a bookmark, and a shared link all show the mark instead of a blank page glyph.
- [x] The tile is square with the app's espresso value and the letter in its cream value; no other colour is introduced.
- [x] The file is valid SVG that renders as expected when opened directly in a browser.

## Comments

- 2026-10-19 — Implemented on `feat/form-layout-polish-spec`.
  - `src/app/icon.svg` supplies the icon through the App Router file convention. Neither a manifest, a bitmap, an apple touch icon, nor a dependency was added.
  - The mark is a 64×64 square tile in the app's espresso (`#2E2620`) with a bold cream (`#FDF9F4`) `W` in a generic serif stack (`Georgia, "Times New Roman", Times, serif`), centred and kept clear of the edge. The standalone SVG cannot import the theme or `BUSINESS_NAME`, so the two colour literals are the only duplication; the file notes that they match `globals.css`.
  - `README.md`'s project-structure tree now lists `src/app/icon.svg`.
  - Verified: the SVG is well-formed (including when parsed by librsvg); `npm run typecheck` clean; full `vitest run` (55 files, 491 passed); `npm run build` succeeds and lists `/icon.svg`; the running app emits `<link rel="icon" href="/icon.svg?…" sizes="any" type="image/svg+xml">`; and `/icon.svg` is served as `image/svg+xml`.
  - Verified legibility by rendering the file at 16px and 32px: the `W` reads clearly, with ink margins of 2px at 16px and 5px at 32px. Contrast is cream on espresso (≈13.6:1) against both light and dark browser chrome. Bookmark and link-preview surfaces that derive their icon from the favicon show the mark; an OG image remains out of scope as the spec states.
  - Code review (standards + spec axes) led to removing the unnecessary `role`/`aria-label` (it hardcoded the business name and duplicated `BUSINESS_NAME`) and removing `textLength`/`lengthAdjust` so the glyph keeps its natural serif shape at tab size. No other findings.
