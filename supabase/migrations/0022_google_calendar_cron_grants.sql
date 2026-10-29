-- 0022_google_calendar_cron_grants.sql — google-calendar-mirror ticket 03.
--
-- WHAT: lets the sessionless daily cron call the two mirror queue RPCs.
--
-- WHY: 0021 revoked the default PUBLIC execute and granted it only to
-- `authenticated`. The cron route has no admin session, so it uses the
-- server-only service-role client; that role bypasses RLS but still needs
-- EXECUTE on the functions. Keeping the grant explicit avoids depending on
-- project-level default privileges.
--
-- PRIVACY: no new table or policy. The service-role key stays server-only and
-- is never exposed to the browser.

grant execute on function enqueue_google_calendar_work(uuid, text) to service_role;
grant execute on function claim_google_calendar_work(uuid) to service_role;
