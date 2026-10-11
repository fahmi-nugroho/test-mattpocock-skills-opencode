# 01: Scaffold app + domain seam

**What to build:** A runnable Next.js 14 + Tailwind + Supabase client shell with the single agreed pure domain seam implemented and unit-tested, so every later ticket builds on green logic.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Next.js App Router + Tailwind runs locally with env for Supabase URL/anon key
- [x] `computeDayStatus`, `doesOverlap`, `buildWaLink` implemented as pure functions per spec calendar rule
- [x] Vitest covers available / fully_booked / blocked, overlap true/false, wa.me URL encoding
- [x] id-ID date + IDR format helpers present

## Comments

Resolved on `integration/mua-website` at `3f59542` (feat `1f8ede7`). Verified at HEAD `205e6a4`: 182/182 Vitest pass, tsc clean, `next build` green.
