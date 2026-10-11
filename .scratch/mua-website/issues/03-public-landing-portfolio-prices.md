# 03: Public landing portfolio prices WA

**What to build:** Responsive public landing with artist profile hero, filterable portfolio grid, and price list with cover images, each wired to WhatsApp deep-links, so a mobile client can browse and start a chat.

**Blocked by:** 02 (needs services + portfolio reads).

**Status:** resolved

- [x] Hero/profile + floating/general WA button with ID copy
- [x] Portfolio grid with category filter (visible only, lazy images)
- [x] Price cards show cover image, IDR price, duration, per-service WA prefill “Halo, mau tanya [service]” (no date)
- [x] Mobile-first responsive, past-safe formatting

## Comments

Resolved on `integration/mua-website` at `69cf48b`. 54/54 Vitest pass, tsc clean, `next build` green. Code-review: standards 0 hard violations, spec 4/4 boxes met (0005 RPC extension justified in review).
