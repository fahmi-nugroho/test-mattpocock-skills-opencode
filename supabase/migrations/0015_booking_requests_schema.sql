-- 0015_booking_requests_schema.sql — booking-request-intake ticket 01.
--
-- WHAT: adds six plain-scalar columns to bookings (event_type, headcount,
-- venue, hairdo, total_price, dp_amount) and creates booking_requests, the
-- stored submission a client sends back through a Format Booking link. The
-- table carries a per-request token, the three bookkeeping timestamps, the
-- client-owned fields, the requested slot, and the accepted booking link.
--
-- WHY: the admin currently retypes every WhatsApp booking line by hand. The
-- Format Booking link moves that typing to the client, and this migration is
-- the storage the link writes into. A Booking Request can never occupy the
-- calendar and never carries a price — only the admin accepts it into a
-- Booking, through the existing validation and conflict guards.
--
-- DEFAULTS RATIONALE: every non-null column defaults so a booking or a
-- request can be created with only the fields actually known at the time.
-- event_type/venue/hairdo/notes default to '' (unknown until known, and ''
-- keeps each column a plain scalar); headcount defaults to 1 and dp_amount
-- to 0 (one person, no down payment yet); total_price is nullable because
-- null means "not quoted yet" and 0 would falsely claim a free booking. The
-- requested slot (date/start_time/end_time) is nullable because the admin
-- may generate the link before anything is agreed.
--
-- TIME REPRESENTATION: the requested slot stays date + zero-padded "HH:MM"
-- text, exactly like bookings/blocks in 0001, so it can flow into the same
-- availability seam. timestamptz is used ONLY for the three server-side
-- token bookkeeping facts (created_at, expires_at, submitted_at); they are
-- never compared as a local wall-clock window, so the 0001 reasoning does
-- not apply to them.
--
-- TOKEN: the token is a database-generated 128-bit random value
-- (gen_random_bytes(16), hex-encoded), deliberately distinct from the row id
-- so the id is never enumerable and a request cannot be guessed.
-- gen_random_bytes comes from pgcrypto, created below (idempotent) and
-- documented here; it is separate from gen_random_uuid (core, see 0001).
--
-- PRIVACY CONTRACT: booking_requests follows the existing pattern exactly —
-- no policy for the anonymous role, full CRUD for the authenticated role.
-- The public never reads or writes the table directly; all public access goes
-- through two future security-definer functions (ticket 02) that expose only
-- what the admin already typed on the link plus the client's own fields, and
-- never a price or another client's data. The six new bookings columns are
-- plain scalars outside the calendar seam: get_day_schedule /
-- get_month_availability and their confirmed-only occupancy rule are
-- untouched.

-- gen_random_bytes (128-bit token default) lives in pgcrypto; gen_random_uuid
-- is core.
create extension if not exists pgcrypto;

-- Six new plain-scalar booking columns. Nothing here participates in the
-- availability derivation (see src/lib/availability.ts).
alter table bookings
  add column event_type text not null default '';

alter table bookings
  add column headcount integer not null default 1
    check (headcount >= 1);

alter table bookings
  add column venue text not null default '';

alter table bookings
  add column hairdo text not null default '';

-- Nullable: null means "not quoted yet" (0 is a real, free quote).
alter table bookings
  add column total_price integer
    check (total_price is null or total_price >= 0);

alter table bookings
  add column dp_amount integer not null default 0
    check (dp_amount >= 0);

-- Client submissions from a Format Booking link. Never public: anon has no
-- policy, and all public access goes through security-definer RPCs.
create table booking_requests (
  id uuid primary key default gen_random_uuid(),
  -- DB-generated 128-bit random value, distinct from the row id.
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  submitted_at timestamptz,
  accepted_booking_id uuid unique references bookings (id) on delete set null,
  -- Client-owned fields (the public submit function writes only these).
  client_name text not null default '',
  client_phone text not null default '',
  event_type text not null default '',
  headcount integer not null default 1 check (headcount >= 1),
  venue text not null default '',
  hairdo text not null default '',
  notes text not null default '',
  -- Requested slot: nullable (admin may generate the link before agreement),
  -- date + zero-padded "HH:MM" text like bookings. start < end applies only
  -- when both times are present.
  date date,
  start_time text check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  check (start_time is null or end_time is null or start_time < end_time)
);

alter table booking_requests enable row level security;

-- Admin full CRUD (single-admin model: any authenticated user is the admin).
-- No anon policy exists by design: the public goes through the RPCs.
create policy booking_requests_admin_all on booking_requests
  for all to authenticated
  using (true) with check (true);
