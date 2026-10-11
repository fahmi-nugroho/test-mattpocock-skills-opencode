-- 0009_day_schedule_free.sql — calendar-day-detail ticket 03.
--
-- Extends get_day_schedule(p_date date) with the server-derived free
-- gaps: each {start, end} with "HH:MM" is a maximal gap between the
-- clamped occupied intervals inside the internal [open, close) window.
-- Days with no occupied ranges return free as [] (the UI renders those
-- as Seharian tersedia), so the full operating window never reaches the
-- browser as gap endpoints.
--
-- Privacy contract (extends 0004/0007/0008): gaps are derived purely
-- from interval endpoints — no client PII, no block reasons, and no
-- operating-hours values reach the returned object. Hours stay internal
-- (window edges for the gap walk). Pending/cancelled bookings do not
-- occupy, so they never shrink the gaps. All-day closures return both
-- occupied and free as [] since the UI collapses them to one closed row.
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
  v_free jsonb := json_build_array();
  v_cursor text;
  v_rec record;
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

    -- free: maximal gaps between the clamped occupied intervals.
    -- Same clamped ordering as occupied, so the walk sees one timeline.
    v_cursor := v_open;
    for v_rec in
      select c.s as s, c.e as e
        from (
          select greatest(bk.start_time, v_open) as s,
                 least(bk.end_time, v_close) as e
            from bookings bk
           where bk.date = p_date and bk.status = 'confirmed'
          union all
          select greatest(bl.start_time, v_open) as s,
                 least(bl.end_time, v_close) as e
            from blocks bl
           where bl.date = p_date and not bl.all_day
        ) c
       where c.s < c.e
       order by c.s
    loop
      if v_rec.s > v_cursor then
        v_free := v_free || jsonb_build_array(
          jsonb_build_object('start', v_cursor, 'end', v_rec.s)
        );
      end if;
      if v_rec.e > v_cursor then
        v_cursor := v_rec.e;
      end if;
    end loop;
    if v_cursor < v_close then
      v_free := v_free || jsonb_build_array(
        jsonb_build_object('start', v_cursor, 'end', v_close)
      );
    end if;
    -- No occupied ranges: drop the gaps so the full window never ships
    -- as endpoints (empty days render as Seharian tersedia instead).
    if jsonb_array_length(v_occupied) = 0 then
      v_free := json_build_array();
    end if;

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
    'free', v_free
  );
end;
$$;

-- Public calendar reads the RPC; raw tables stay anon-denied.
grant execute on function get_day_schedule(date) to anon, authenticated;
