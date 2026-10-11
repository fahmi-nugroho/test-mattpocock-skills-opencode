-- 0007_day_schedule.sql — calendar-day-detail ticket 01: public day-detail RPC.
--
-- get_day_schedule(p_date date) returns one jsonb object per day:
-- {date, status, all_day_blocked, occupied, free} with status in
-- (available | fully_booked | blocked).
--
-- Privacy contract (extends 0004): it NEVER returns bookings/blocks/
-- settings rows, so no client PII (names, phones, notes, block reasons)
-- and no operating hours can leak to the public calendar. Times are not
-- returned in v1 either — occupied/free ride along as empty arrays so
-- the shape stays stable for tickets 02/03 which fill them in.
-- Security definer + fixed search_path: anon can execute the RPC while
-- raw-table RLS still denies anon reads on bookings/blocks/settings.
--
-- Status mirrors get_month_availability for a single day: blocked if the
-- date is in full_dates or has an all-day block; else fully_booked if
-- confirmed bookings + time-range blocks jointly cover every minute of
-- [open, close); else available. Pending/cancelled bookings do not occupy.

create or replace function get_day_schedule(p_date date)
returns jsonb
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
  v_status text;
  v_all_day boolean := false;
begin
  select s.open_hour, s.close_hour, s.full_dates
    into v_open, v_close, v_full_dates
    from settings s where s.id = 1;
  if not found then
    raise exception 'Missing settings row (id=1)';
  end if;

  v_open_min := hhmm_to_min(v_open);
  v_close_min := hhmm_to_min(v_close);

  -- all-day closure: manual full-toggle or an all-day block.
  if p_date = any (v_full_dates)
     or exists (select 1 from blocks b
                where b.date = p_date and b.all_day) then
    v_status := 'blocked';
    v_all_day := true;
  -- fully_booked: confirmed bookings + time-range blocks jointly cover
  -- every minute of [open, close). Pending/cancelled do not occupy.
  elsif not exists (
    with occupied as (
      select greatest(hhmm_to_min(bk.start_time), v_open_min) as s,
             least(hhmm_to_min(bk.end_time), v_close_min) as e
        from bookings bk
       where bk.date = p_date and bk.status = 'confirmed'
      union all
      select greatest(hhmm_to_min(bl.start_time), v_open_min) as s,
             least(hhmm_to_min(bl.end_time), v_close_min) as e
        from blocks bl
       where bl.date = p_date and not bl.all_day
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

  return json_build_object(
    'date', p_date,
    'status', v_status,
    'all_day_blocked', v_all_day,
    'occupied', json_build_array(),
    'free', json_build_array()
  );
end;
$$;

-- Public calendar reads the RPC; raw tables stay anon-denied.
grant execute on function get_day_schedule(date) to anon, authenticated;
