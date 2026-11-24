alter table public.google_calendar_connection
  add column last_synced_at timestamptz;

update public.google_calendar_connection
set last_synced_at = (select max(last_synced_at) from public.google_calendar_events)
where id = 1;

create or replace function public.touch_google_calendar_connection()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  -- A slow drain must not replace a later drain's timestamp.
  new.last_synced_at := greatest(old.last_synced_at, new.last_synced_at);
  return new;
end;
$$;
