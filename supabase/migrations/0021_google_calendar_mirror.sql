-- 0021_google_calendar_mirror.sql — google-calendar-mirror ticket 02.
--
-- WHAT: creates the two admin-only tables the Calendar Mirror needs to keep
-- Google in step with confirmed Bookings, plus the two functions that
-- coalesce work and claim it one Booking at a time.
--
-- WHY: a Booking save must never wait on Google. The save writes the Booking
-- exactly as before and leaves one work intent behind; a server route drains
-- that intent and records the Google event id so a later edit updates rather
-- than duplicates. The tables also remember a Retry's last error and when it
-- should next run. See .scratch/google-calendar-mirror/spec.md and
-- docs/adr/0004-google-calendar-is-a-one-way-booking-mirror.md.
--
-- NO CASCADE, DELIBERATELY: neither table references `bookings`. A hard delete
-- must remove the Booking and still leave the Google event id behind long
-- enough to delete the event. ON DELETE CASCADE would erase that pointer first;
-- a plain foreign key would refuse the delete instead. The tracked row is
-- removed only after Google confirms the event is gone, so reconcile can also
-- clean up a row orphaned by a delete that happened while Google was down.
--
-- ONE EVENT PER BOOKING: `google_calendar_events.booking_id` is the primary key.
-- Even if two drains race, a second tracked row for the same Booking cannot be
-- inserted. `google_calendar_work.booking_id` is likewise the primary key, so a
-- Booking has at most one intent; repeated saves refresh that same row instead
-- of stacking duplicate work.
--
-- PRIVACY: follows the invoices/booking_requests pattern — RLS enabled, full
-- access for the authenticated admin, no policy for anon. The tables hold
-- Booking references and a Google event id, never client PII or credentials.

create table google_calendar_events (
  booking_id uuid primary key,
  google_event_id text not null,
  last_synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table google_calendar_work (
  booking_id uuid primary key,
  operation text not null
    check (operation in ('upsert', 'delete')),
  attempt_count integer not null default 0
    check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text not null default '',
  -- Null means the intent is still open. Set only after Google succeeded.
  processed_at timestamptz,
  -- A short-lived claim marker; stale claims are reclaimable so a crashed
  -- drain cannot strand a Booking forever.
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index google_calendar_work_open_idx
  on google_calendar_work (next_attempt_at)
  where processed_at is null;

create or replace function touch_google_calendar_mirror_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger google_calendar_events_touch
  before update on google_calendar_events
  for each row
  execute function touch_google_calendar_mirror_row();

create trigger google_calendar_work_touch
  before update on google_calendar_work
  for each row
  execute function touch_google_calendar_mirror_row();

alter table google_calendar_events enable row level security;
alter table google_calendar_work enable row level security;

-- Admin full CRUD (single-admin model: any authenticated user is the admin).
-- No anon policy exists by design: the browser goes through the authenticated
-- admin route and never holds a Google credential.
create policy google_calendar_events_admin_all on google_calendar_events
  for all to authenticated
  using (true) with check (true);

create policy google_calendar_work_admin_all on google_calendar_work
  for all to authenticated
  using (true) with check (true);

-- Coalescing write from the Booking save. Any existing open or failed intent
-- is refreshed in place: one pending intent per Booking, with retry state
-- reset so the new save is attempted immediately.
create or replace function enqueue_google_calendar_work(
  p_booking_id uuid,
  p_operation text
)
returns void
language sql
set search_path = public
as $$
  insert into google_calendar_work (booking_id, operation)
  values (p_booking_id, p_operation)
  on conflict (booking_id) do update
    set operation = excluded.operation,
        attempt_count = 0,
        next_attempt_at = now(),
        last_error = '',
        processed_at = null,
        -- Keep a fresh claim so a drain already holding this Booking is not
        -- raced by a second drain after a repeated save; an abandoned claim
        -- is released for the next run.
        locked_at = case
          when google_calendar_work.locked_at is not null
           and google_calendar_work.locked_at >= now() - interval '10 minutes'
          then google_calendar_work.locked_at
          else null
        end;
$$;

-- Per-Booking claim. Only one drain can take the row; another sees no row and
-- skips until the next run. A claim older than ten minutes is treated as
-- abandoned and may be retaken.
create or replace function claim_google_calendar_work(p_booking_id uuid)
returns setof google_calendar_work
language sql
set search_path = public
as $$
  update google_calendar_work
     set locked_at = now()
   where booking_id = p_booking_id
     and processed_at is null
     and (locked_at is null or locked_at < now() - interval '10 minutes')
  returning *;
$$;

-- Admin-only functions: revoke the default PUBLIC execute first.
revoke all on function enqueue_google_calendar_work(uuid, text) from public;
grant execute on function enqueue_google_calendar_work(uuid, text) to authenticated;

revoke all on function claim_google_calendar_work(uuid) from public;
grant execute on function claim_google_calendar_work(uuid) to authenticated;
