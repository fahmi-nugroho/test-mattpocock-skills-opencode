# 05: Admin auth overview settings

**What to build:** Private admin area with email+password login, today/upcoming overview, and operating settings editing, so the artist controls WA number and hours.

**Blocked by:** 02 (needs settings table + auth RLS).

**Status:** ready-for-agent

- [ ] `/admin/login` single-admin email+password via Supabase Auth, `/admin` guarded
- [ ] Overview shows today + upcoming Booking counts (confirmed/pending)
- [ ] Settings form edits wa_number, open/close hour, persists and reflects in calendar derivation
- [ ] No public signup exposed
