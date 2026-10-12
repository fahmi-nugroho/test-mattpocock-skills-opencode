-- 0012_settings_drop_hours.sql — calendar-popup-inquiry ticket 04.
--
-- Drops the operating-hours columns from settings. The month and day
-- RPCs were already redefined window-free (0011 redefines
-- get_month_availability; 0010 redefined get_day_schedule), so nothing
-- reads these columns anymore; the admin form persists wa_number only.
--
-- RESTORE NOTE (how to re-add): run a forward migration with
--   alter table settings
--     add column open_hour text not null default '09:00'
--       check (open_hour ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
--     add column close_hour text not null default '19:00'
--       check (close_hour ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
--     add check (open_hour < close_hour);
-- then reintroduce coverage derivation in get_month_availability (see
-- 0004_seed_rpc.sql history for the covered-minutes walk), restore the
-- window arguments on computeDayStatus, and revive the admin hours
-- inputs. See docs/adr/0001-hours-removal.md for what would revive the
-- fully_booked status end to end.
--
-- No data loss beyond the hours values themselves: wa_number and
-- full_dates are untouched by this migration.

alter table settings drop column open_hour;
alter table settings drop column close_hour;
