-- 0010_day_schedule_window_free.sql — calendar-popup-inquiry ticket 01.
--
-- Redefines get_day_schedule(p_date date) as window-free: occupied
-- ranges are returned raw and unclamped at any hour of the day, so
-- early or late work is never silently hidden. The operating window
-- is gone from this function entirely: it reads ONLY full_dates from
-- settings (no open_hour/close_hour reads, no hhmm_to_min conversion,
-- no generate_series coverage walk, no greatest/least window clamp),
-- and free is always [] (no gap walk, so no window endpoints leak).
-- Coverage derivation is removed, so fully_booked is unreachable here:
-- non-closed days resolve to 'available' and all-day closures
-- (manual full-toggle date or an all-day block) resolve to 'blocked'.
--
-- Privacy contract (extends 0004/0007/0008/0009): the query selects
-- only start_time/end_time plus the kind literal — times plus kind
-- only, never client names, phones, notes, service names, block
-- reasons, or operating-hours values. The client validator strips
-- extra keys and fails closed on malformed shapes.
-- Security definer + fixed search_path preserved; anon grant preserved.

create or replace function get_day_schedule(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_dates date[];
  v_status text;
  v_all_day boolean := false;
  v_occupied jsonb := json_build_array();
begin
  select s.full_dates
    into v_full_dates
    from settings s where s.id = 1;
  if not found then
    raise exception 'Missing settings row (id=1)';
  end if;

  -- all-day closure: manual full-toggle or an all-day block. Outranks
  -- times; both ranges collapse to one closed row in the UI.
  if p_date = any (v_full_dates)
     or exists (select 1 from blocks b
                where b.date = p_date and b.all_day) then
    v_status := 'blocked';
    v_all_day := true;
    v_occupied := json_build_array();
  else
    -- occupied: confirmed bookings (booked) + time-range blocks
    -- (blocked), raw and unclamped, sorted chronologically.
    -- Zero-padded "HH:MM" compares chronologically as text. The
    -- start<end guard only drops malformed rows; nothing is clamped.
    select coalesce(
             json_agg(
               json_build_object('start', c.s, 'end', c.e, 'kind', c.kind)
               order by c.s, c.kind
             ),
             json_build_array()
           )
      into v_occupied
      from (
        select bk.start_time as s,
               bk.end_time as e,
               'booked'::text as kind
          from bookings bk
         where bk.date = p_date and bk.status = 'confirmed'
        union all
        select bl.start_time as s,
               bl.end_time as e,
               'blocked'::text as kind
          from blocks bl
         where bl.date = p_date and not bl.all_day
      ) c
     where c.s < c.e;

    -- Window-free: coverage derivation removed; fully_booked is
    -- unreachable. Pending/cancelled never occupy.
    v_status := 'available';
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
