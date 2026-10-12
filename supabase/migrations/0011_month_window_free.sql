-- 0011_month_window_free.sql — calendar-popup-inquiry ticket 04.
--
-- Redefines get_month_availability(p_year, p_month) as window-free,
-- mirroring the 0010 get_day_schedule pattern: it reads ONLY full_dates
-- from settings (no open_hour/close_hour reads, no hhmm_to_min
-- conversion, no generate_series coverage walk, no greatest/least
-- window clamp). Calendar days are walked with plain date arithmetic
-- (no generate_series at all, so the window-free contract stays
-- greppable). Each date resolves to 'blocked' for a manual full-toggle
-- date or an all-day block, else 'available'.
--
-- Coverage derivation is removed, so fully_booked is UNREACHABLE here:
-- the status never resolves to it, but the (date, status) return shape
-- is unchanged and still admits the value, so the dead legend entry and
-- status metadata in the UI keep working if the status is ever revived.
--
-- ORDERING NOTE: this redefine runs BEFORE 0012 drops the settings
-- hours columns. Redefine-first means no live RPC ever references a
-- missing column; dropping first would leave the old window-reading
-- RPC broken until the redefine lands. See docs/adr/0001-hours-removal.md.
--
-- Privacy contract (extends 0004): returns date+status only — never
-- client names, phones, notes, service names, block reasons, or
-- operating-hours values. Security definer + fixed search_path
-- preserved; anon grant preserved.

create or replace function get_month_availability(p_year integer, p_month integer)
returns table (date date, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_dates date[];
  v_first date := make_date(p_year, p_month, 1);
  v_last date := (date_trunc('month', v_first) + interval '1 month' - interval '1 day')::date;
  v_day date;
  v_status text;
begin
  if p_month < 1 or p_month > 12 then
    raise exception 'Invalid month: %', p_month;
  end if;

  select s.full_dates
    into v_full_dates
    from settings s where s.id = 1;
  if not found then
    raise exception 'Missing settings row (id=1)';
  end if;

  v_day := v_first;
  while v_day <= v_last loop
    -- blocked: manual full-toggle or an all-day block.
    if v_day = any (v_full_dates)
       or exists (select 1 from blocks b
                  where b.date = v_day and b.all_day) then
      v_status := 'blocked';
    -- Window-free: coverage derivation removed; fully_booked is
    -- unreachable. Pending/cancelled never occupy (unchanged).
    else
      v_status := 'available';
    end if;

    date := v_day;
    status := v_status;
    return next;

    v_day := v_day + 1;
  end loop;
end;
$$;

-- Public calendar reads the RPC; raw tables stay anon-denied.
grant execute on function get_month_availability(integer, integer) to anon, authenticated;
