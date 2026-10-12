# 02: Hero trust block with portrait and testimonials

**What to build:** a 2-column hero (copy + portrait, stacked on mobile) with trust stats and short testimonials above the existing WA CTAs, so a first-time client trusts the artist immediately.

**Blocked by:** 01 (needs tokens and width foundation).

**Status:** resolved

- [x] Hero shows portrait (owner-supplied, else visible portfolio cover fallback) beside copy and both existing CTAs
- [x] Trust row (years, clients, rating) and 2-3 hardcoded testimonials render from one editable location
- [x] Mobile stacks vertically with no horizontal overflow; WA links unchanged

## Comments

Resolved on `integration/ui-ux-polish`. `src/lib/hero-proof.ts` holds stats/testimonials in one editable location plus `getHeroPortraitUrl` fallback selector (2 Vitest pass); `src/components/hero-trust.tsx` renders 2-col copy+portrait (stacked mobile, `NEXT_PUBLIC_HERO_PORTRAIT` override else first visible cover, placeholder when empty) with trust row + testimonials above the unchanged WA CTAs. 212/212 Vitest pass, tsc clean, `next build` green. No component/snapshot tests per spec testing decisions.
