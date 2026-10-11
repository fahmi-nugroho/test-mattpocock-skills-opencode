-- 0008_day_schedule_occupied.sql — calendar-day-detail ticket 02.
--
-- Extends get_day_schedule(p_date date) with the occupied timed ranges:
-- confirmed bookings as kind 'booked', time-range blocks as kind
-- 'blocked', each {start, end, kind} with "HH:MM" clamped to the
-- internal [open, close) window and sorted chronologically.
--
-- Privacy contract (extends 0004/0007): the query selects only
-- start_time/end_time plus the kind literal — never client names,
-- phones, notes, or block reasons — and operating hours stay internal
-- (used only for clamping, never returned). Pending/cancelled bookings
-- do not occupy. All-day closures still return occupied as [] since the
-- UI collapses them to a single closed row. Free gaps arrive in ticket
-- 03; free stays [] here so the shape is unchanged.
-- Security definer + fixed search_path preserved; anon grant preserved.

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
  v_occupied jsonb := json_build_array();
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
  else
    -- occupied: confirmed bookings (booked) + time-range blocks
    -- (blocked), clamped to [open, close), sorted chronologically.
    -- Zero-padded "HH:MM" compares chronologically as text.
    select coalesce(
             json_agg(
               json_build_object('start', c.s, 'end', c.e, 'kind', c.kind)
               order by c.s, c.kind
             ),
             json_build_array()
           )
      into v_occupied
      from (
        select greatest(bk.start_time, v_open) as s,
               least(bk.end_time, v_close) as e,
               'booked'::text as kind
          from bookings bk
         where bk.date = p_date and bk.status = 'confirmed'
        union all
        select greatest(bl.start_time, v_open) as s,
               least(bl.end_time, v_close) as e,
               'blocked'::text as kind
          from blocks bl
         where bl.date = p_date and not bl.all_day
      ) c
     where c.s < c.e;

    -- fully_booked: confirmed bookings + time-range blocks jointly cover
    -- every minute of [open, close). Pending/cancelled do not occupy.
    if not exists (
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
  end if;

  return json_build_object(
    'date', p_date,
    'status', v_status,
    'all_day_blocked', v_all_day,
    'occupied', v_occupied,
    'free', json_build_array()
  );
end;
$$;

-- Public calendar reads the RPC; raw tables stay anon-denied.
grant execute on function get_day_schedule(date) to anon, authenticated;
