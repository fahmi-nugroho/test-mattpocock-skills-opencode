# 06: Admin navigation density and login polish

**What to build:** a sticky tab bar with hash deep-links over a wider denser dashboard plus list search, and a lightly rebranded login, so the owner manages bookings, blocks, portfolio, prices, and settings fast.

**Blocked by:** 01 (needs shared tokens for consistent branding).

**Status:** resolved

- [x] Dashboard shows sticky tabs (Ringkasan, Kalender, Booking, Blokir, Portfolio, Harga, Pengaturan) with hash links that survive reload, in a wider desktop layout
- [x] Booking, block, portfolio, and service lists gain client-side search with denser rows; all CRUD, overlap guards, and RLS behavior unchanged
- [x] Login keeps the same email+password flow with matching branding, show/hide password, and clear Indonesian error copy

## Comments

Resolved on `integration/ui-ux-polish` at `63f52bd` (dashboard `f41e827` + login `1be15b1` via merge `4d767f1` + review-fix `63f52bd`). 230/230 Vitest pass, tsc clean. Code-review: standards 0 hard violations (shared search-input extraction declined as speculative generality per 01 precedent; lib comments switched to Indonesian; aria-current `true`→`location`); spec 0 missing/creep (all 3 criteria + parent-spec admin-nav/login-polish lines verified, no auth/RLS/RPC touched).
