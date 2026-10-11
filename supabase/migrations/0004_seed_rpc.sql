-- 0004_seed_rpc.sql — ticket 02: settings seed + public month RPC.
--
-- Seed: single settings row (id = 1) with placeholder WA number and
-- 09:00–19:00 operating hours. The real WA number is set by the admin in
-- dashboard settings (ticket 06); replace the placeholder on deploy.
--
-- RPC get_month_availability(p_year, p_month) returns one row per calendar
-- date: (date, status) with status in (available | fully_booked | blocked).
-- It NEVER returns bookings/blocks/settings rows, so no client PII
-- (names, phones, notes, block reasons) can leak to the public calendar.
-- Security definer + fixed search_path: anon can execute the RPC while
-- raw-table RLS still denies anon reads on bookings/blocks/settings.

insert into settings (id, wa_number, open_hour, close_hour, full_dates)
values (1, '6280000000000', '09:00', '19:00', '{}')
on conflict (id) do nothing;

-- "HH:MM" text -> minutes since midnight (inputs are check-constrained).
create or replace function hhmm_to_min(t text)
returns integer
language sql immutable
set search_path = public
as $$ select split_part(t, ':', 1)::int * 60 + split_part(t, ':', 2)::int $$;

create or replace function get_month_availability(p_year integer, p_month integer)
returns table (date date, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open text;
  v_close text;
  v_open_min integer;
  v_close_min integer;
  v_full_dates date[];
  v_first date := make_date(p_year, p_month, 1);
  v_last date := (date_trunc('month', v_first) + interval '1 month' - interval '1 day')::date;
  v_day date;
  v_status text;
begin
  if p_month < 1 or p_month > 12 then
    raise exception 'Invalid month: %', p_month;
  end if;

  select s.open_hour, s.close_hour, s.full_dates
    into v_open, v_close, v_full_dates
    from settings s where s.id = 1;
  if not found then
    raise exception 'Missing settings row (id=1)';
  end if;

  v_open_min := hhmm_to_min(v_open);
  v_close_min := hhmm_to_min(v_close);

  for v_day in select generate_series(v_first, v_last, interval '1 day')::date loop
    -- blocked: manual full-toggle or an all-day block.
    if v_day = any (v_full_dates)
       or exists (select 1 from blocks b
                  where b.date = v_day and b.all_day) then
      v_status := 'blocked';
    -- fully_booked: confirmed bookings + time-range blocks jointly cover
    -- every minute of [open, close). Pending/cancelled bookings do not
    -- occupy the day (matches overlap guard scope: confirmed only).
    elsif not exists (
      with occupied as (
        select greatest(hhmm_to_min(bk.start_time), v_open_min) as s,
               least(hhmm_to_min(bk.end_time), v_close_min) as e
          from bookings bk
         where bk.date = v_day and bk.status = 'confirmed'
        union all
        select greatest(hhmm_to_min(bl.start_time), v_open_min) as s,
               least(hhmm_to_min(bl.end_time), v_close_min) as e
          from blocks bl
         where bl.date = v_day and not bl.all_day
      ),
      minutes as (
        select generate_series(v_open_min, v_close_min - 1) as m
      )
      select 1 from minutes mn
       where not exists (select 1 from occupied o
                         where o.s <= mn.m and mn.m < o.e)
    ) then
      v_status := 'fully_booked';
    else
      v_status := 'available';
    end if;

    date := v_day;
    status := v_status;
    return next;
  end loop;
end;
$$;

-- Public calendar reads the RPC; raw tables stay anon-denied.
grant execute on function hhmm_to_min(text) to anon, authenticated;
grant execute on function get_month_availability(integer, integer) to anon, authenticated;
