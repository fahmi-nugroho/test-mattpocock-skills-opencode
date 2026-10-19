# 06: Give the app an icon

**What to build:** The app gets its first icon, supplied through the app router's file convention so no manifest and no build dependency are added. The mark is the business's initial — a serif W in cream on the espresso tile, so it stays legible at tab size on both light and dark browser chrome. It is a vector file, hand-editable, and the only icon: no bitmap fallback, no apple touch icon, no manifest.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] An icon file is served through the app router's convention, with no manifest, no bitmap, and no new project dependency.
- [ ] The mark is a serif W in cream on the espresso tile, drawn as vector paths or text in a generic serif stack (a document icon cannot load the app's display font).
- [ ] The mark is legible at 16px and 32px: the letter reads as a W, does not touch the tile edge, and keeps its contrast against both light and dark browser chrome.
- [ ] A browser tab, a bookmark, and a shared link all show the mark instead of a blank page glyph.
- [ ] The tile is square with the app's espresso value and the letter in its cream value; no other colour is introduced.
- [ ] The file is valid SVG that renders as expected when opened directly in a browser.

## Comments
