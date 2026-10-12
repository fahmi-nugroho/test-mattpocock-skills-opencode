# 03: Portfolio lightbox with style WA inquiry

**What to build:** tap-to-open portfolio detail (large photo, title, category, prev/next, ESC/backdrop close) with a style-specific WA button, so a client can judge detail and ask about that look in one tap.

**Blocked by:** 01 (needs tokens and width foundation).

**Status:** resolved

- [x] Tapping a thumbnail opens a lightbox with large photo, title, category, prev/next navigation and accessible close
- [x] Lightbox CTA builds a correct wa.me link with prefilled style message (title + category) via the new pure builder, covered by a Vitest unit test
- [x] Existing category filter behavior unchanged

## Comments

Resolved on `integration/ui-ux-polish` at `f6a3dfe` (feature `71dfa24` + review-fix `f6a3dfe`). 215/215 Vitest pass, tsc clean, `next build` green. Code-review: standards 0 hard violations (4 judgement-call smells fixed or kept-with-reason: selected→selectedIndex/current→selectedItem renames, step(delta) dedup; title+category params kept matching service/date builder pattern); spec findings fixed (split keydown vs open/close effects so prev/next no longer steals focus or flickers scroll-lock; OOB index normalises to null so no leaked overflow/ESC listener). Arrow keys, wrap-around, counter, scroll-lock, auto-close-on-filter kept as standard lightbox behavior per story 6 "browsing feels effortless". `src/lib/whatsapp.ts` gains pure `buildStyleWaMessage`/`buildStyleWaLink` reusing `buildWaLink`; `src/components/portfolio-grid.tsx` gains `waNumber` prop + dialog lightbox (ESC/backdrop/arrow close, focus return, scroll lock); `src/app/page.tsx` passes `waNumber`. No component/snapshot tests per spec testing decisions.
