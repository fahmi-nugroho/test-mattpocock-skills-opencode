-- 0001_schema.sql — ticket 02: core tables.
--
-- TIME REPRESENTATION CHOICE (documented per ticket): booking/block times
-- are stored as date + zero-padded "HH:MM" text, NOT timestamptz. This keeps
-- SQL rows directly compatible with the computeDayStatus seam in
-- src/lib/availability.ts (BookingForDay/BlockForDay use "HH:MM" strings,
-- compared lexicographically), avoids timezone-shift bugs for a local
-- (WIB, id-ID) availability calendar, and matches the ticket constraint.

-- Services / price items (public: only active rows readable).
create table services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price_idr integer not null check (price_idr >= 0),
  duration_min integer not null check (duration_min > 0),
  active boolean not null default true,
  cover_image_url text,
  sort integer not null default 0
);

-- Portfolio items (public: only visible rows readable).
create table portfolio_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  image_url text not null,
  sort integer not null default 0,
  visible boolean not null default true
);

-- Admin-created bookings. date + "HH:MM" text ranges; zero-padded so
-- plain string comparison matches chronological order (same rule as
-- doesOverlap in src/lib/availability.ts).
create table bookings (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  start_time text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text not null check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  service_id uuid references services (id) on delete set null,
  client_name text not null,
  client_phone text not null,
  notes text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled')),
  check (start_time < end_time)
);

-- Admin-created blocks: either all_day OR a start-end range with reason.
create table blocks (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  all_day boolean not null default false,
  start_time text check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  reason text not null default '',
  -- all_day=true forces NULL times (no valid-time bypass); otherwise a
  -- valid non-null HH:MM range with start < end is required.
  check (
    (all_day and start_time is null and end_time is null)
    or (not all_day
        and start_time is not null and end_time is not null
        and start_time < end_time)
  )
);

-- Operating settings: single row with id = 1. full_dates holds manually
-- closed dates ("mark day full" toggle) as a date array.
create table settings (
  id integer primary key,
  wa_number text not null,
  open_hour text not null check (open_hour ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  close_hour text not null check (close_hour ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  full_dates date[] not null default '{}',
  check (id = 1),
  check (open_hour < close_hour)
);

-- Lookup indexes for the month-availability RPC and admin lists.
create index bookings_date_idx on bookings (date);
create index blocks_date_idx on blocks (date);
create index services_active_sort_idx on services (active, sort);
create index portfolio_items_visible_sort_idx on portfolio_items (visible, sort);
