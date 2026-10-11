# 01: Scaffold app + domain seam

**What to build:** A runnable Next.js 14 + Tailwind + Supabase client shell with the single agreed pure domain seam implemented and unit-tested, so every later ticket builds on green logic.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Next.js App Router + Tailwind runs locally with env for Supabase URL/anon key
- [ ] `computeDayStatus`, `doesOverlap`, `buildWaLink` implemented as pure functions per spec calendar rule
- [ ] Vitest covers available / fully_booked / blocked, overlap true/false, wa.me URL encoding
- [ ] id-ID date + IDR format helpers present
