# 01: Brand tokens and landing width foundation

**What to build:** the warm elegant visual foundation across the landing — warm neutrals, serif display headings, wider responsive container — so every later slice lands on consistent styling.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Landing shows warm neutral palette with serif H1/H2 and sans body, mobile-first legible at 360px
- [x] Landing container widens on desktop with responsive grids (hero stacks on mobile, multi-column on desktop)
- [x] Existing WA-first flow, Indonesian copy, and day-status semantics unchanged (visual verification only)

## Comments

Resolved on `integration/ui-ux-polish` at `4102300` (feature `bcc66da` + review-fix `4102300`). 210/210 Vitest pass, tsc clean, `next build` green. Code-review: standards 0 hard violations (4 judgement-call smells, Button/Card extraction deferred as speculative generality); spec findings fixed (warm-tinted day-status shades, single-source selection token, 360px legibility verified). Hero 2-col copy+portrait intentionally deferred to ticket 02 (marker comment in `page.tsx`); Button/Card extraction and rose/plum left for later slices.
