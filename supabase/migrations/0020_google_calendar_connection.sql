-- 0020_google_calendar_connection.sql — google-calendar-mirror ticket 01.
--
-- WHAT: creates the single-row `google_calendar_connection` record the admin
-- settings section reads and writes: the mirror's enabled flag, the connected
-- calendar id, when it was last verified, the latest error, and when the row
-- changed.
--
-- WHY: the Calendar Mirror needs one place to remember whether it is on and
-- why it is unhealthy without asking Google on every page load. The enabled
-- flag is the master switch: while it is false the server refuses to drain any
-- mirror work, so disconnecting stops all writes while leaving the events
-- already in Google untouched. See
-- .scratch/google-calendar-mirror/spec.md and docs/adr/0004.
--
-- SINGLE ROW: id is fixed at 1 by the CHECK and seeded below, following the
-- settings table's approach, so the admin always reads and updates the same
-- record.
--
-- PRIVACY: follows the booking_requests/invoices pattern — RLS is enabled, the
-- authenticated admin gets full access, and there is no anon policy. Google
-- credentials themselves never live in this table; they stay in server-only
-- environment values.

create table google_calendar_connection (
  id integer primary key default 1,
  enabled boolean not null default false,
  calendar_id text not null default '',
  last_verified_at timestamptz,
  last_error text not null default '',
  updated_at timestamptz not null default now(),
  check (id = 1)
);

create or replace function touch_google_calendar_connection()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger google_calendar_connection_touch
  before update on google_calendar_connection
  for each row
  execute function touch_google_calendar_connection();

alter table google_calendar_connection enable row level security;

-- Admin full CRUD (single-admin model: any authenticated user is the admin).
-- No anon policy exists by design: the browser reads the connection status
-- through an authenticated admin route, never a credential.
create policy google_calendar_connection_admin_all on google_calendar_connection
  for all to authenticated
  using (true) with check (true);

-- The mirror starts disconnected until the admin tests and connects it.
insert into google_calendar_connection (id) values (1)
on conflict (id) do nothing;
