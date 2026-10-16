-- 0014_public_profile_rpc.sql — ticket 03: public profil RPC.
--
-- WHAT: exposes headline/subcopy/portrait_url from the single-row
-- settings table (id = 1) to the anonymous landing without opening the
-- raw settings table (still anon-denied per 0002/0013: no anon SELECT
-- policy on settings, so wa_number-adjacent internals like full_dates
-- never reach the browser directly — wa_number itself stays behind
-- get_public_wa_number).
--
-- WHY RPC: mirrors the get_public_wa_number pattern (0005): SECURITY
-- DEFINER function returning only the three public profil columns.
-- Stats/testimoni stay on direct anon SELECT (visible-only RLS from
-- 0013) since they carry no sensitive columns.
--
-- FALLBACK: returns null row when settings id = 1 is missing; the
-- landing's getLandingData catches RPC errors and renders the hardcoded
-- FALLBACK_HEADLINE/SUBCOPY + portfolio-cover portrait instead.

create or replace function get_public_profile()
returns table (
  headline text,
  subcopy text,
  portrait_url text
)
language sql
security definer
stable
set search_path = public
as $$ select headline, subcopy, portrait_url from settings where id = 1 $$;

grant execute on function get_public_profile() to anon, authenticated;
