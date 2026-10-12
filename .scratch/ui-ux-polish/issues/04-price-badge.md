# 04: Price hierarchy with featured badge

**What to build:** price-forward service cards with one "Paling Dipilih" badge driven by sort order, so a client scans cost fast and gets guided to the popular choice.

**Blocked by:** 01 (needs tokens and width foundation).

**Status:** resolved

- [x] Cards show prominent IDR price with subtle duration and keep per-service WA prefill buttons
- [x] Exactly one badge appears on the first active service by ascending sort (none when no active service) via the new pure selector, covered by a Vitest unit test
- [x] No schema migration; owner controls the badge through the existing sort field

## Comments

Resolved on `integration/ui-ux-polish` at `8d2ab6b` (feature `cbc147d` + review-fix `8d2ab6b`). 219/219 Vitest pass, tsc clean, `next build` green. Code-review: standards 0 hard violations (1 judgement-call dedup fixed via `isFeatured`); spec findings fixed (unasked gold ring/shadow emphasis removed — featured card now differs by badge only). `src/lib/featured-service.ts` holds pure `getFeaturedService` (first active by ascending sort, else null) + `FEATURED_BADGE_LABEL` ("Paling Dipilih") with 4 Vitest tests; `src/components/price-list.tsx` renders the badge once via `featuredId` equality, price `text-lg font-extrabold sm:text-xl`, duration `text-xs text-stone-500`, WA prefill unchanged. No component/snapshot tests per spec testing decisions.
