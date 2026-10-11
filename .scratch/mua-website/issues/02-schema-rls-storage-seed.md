# 02: Schema RLS storage seed

**What to build:** Supabase backend for Services, Portfolio Items, Bookings, Blocks, and Operating Settings with RLS and image buckets, so public reads are safe and admin can write.

**Blocked by:** 01 (needs scaffold + seam types to match schema).

**Status:** ready-for-agent

- [ ] Tables `services`, `portfolio_items`, `bookings`, `blocks`, `settings(full_dates[])` with spec columns
- [ ] RLS: anon can read active services / visible portfolio / day-status only (no client PII); authenticated admin full CRUD
- [ ] Storage buckets `portfolio/`, `prices/` public-read, authenticated-write
- [ ] Seed settings row (wa_number, 09:00–19:00) + month day-status RPC returning only status per date
