-- 0005_public_wa.sql — ticket 03: public WA-number RPC.
--
-- The raw settings table stays anon-denied (0002_rls.sql): anon must never
-- read open_hour / close_hour / full_dates. The public landing still needs
-- the contact number for WA deep-links, so expose wa_number alone through
-- a SECURITY DEFINER RPC returning text only. No PII (names, phones,
-- notes, block reasons) passes through this function.

create or replace function get_public_wa_number()
returns text
language sql
security definer
stable
set search_path = public
as $$ select wa_number from settings where id = 1 $$;

grant execute on function get_public_wa_number() to anon, authenticated;
