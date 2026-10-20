-- 0018_invoices_schema.sql — invoice-and-booking-filter ticket 01.
--
-- WHAT: creates the admin-only `invoices` table, the `create_invoice`
-- allocation function, and the four payment columns on settings.
--
-- WHY: an Invoice is a frozen snapshot of a Booking's details and payment
-- position at the moment it was issued. It is never a live view: several
-- invoices can exist for one booking, and each keeps showing exactly what the
-- client was told even after the booking moves on. This migration is the one
-- foundation every later invoice ticket reads; it has no user-visible screen.
-- See .scratch/invoice-and-booking-filter/spec.md.
--
-- NUMBERING: one business-wide series, `invc-NN/YYYY`, restarting each
-- January. `year`, `seq` and `number` are stored per row; `(year, seq)` and
-- `number` are unique, and table CHECKs pin the year to `issued_on` and the
-- number to that year + sequence. An issue date therefore can never be moved
-- into another year's series. The create function takes a transaction-scoped
-- advisory lock on the year and allocates `max(seq) + 1` — not `count + 1`, so
-- deleting the newest unsent invoice frees its number for the next issue
-- instead of leaving a silent gap.
--
-- SNAPSHOT: every displayed field is copied from the Booking row inside the
-- same function (joining the service name, falling back to '' when the
-- service is gone), so a picture can never disagree with what was stored.
-- The function raises Indonesian refusals for a cancelled booking, a booking
-- without an agreed total, a booking without a recorded DP, a DP above the
-- total, and a due date before the issue date.
--
-- PRIVACY: follows the booking_requests pattern exactly — RLS is enabled, the
-- authenticated admin gets full access, and no policy exists for anon. The
-- allocation function is executable only by authenticated (PUBLIC execute is
-- revoked); settings gains four more admin-only columns with no public read.
--
-- EMPTY PAYMENT SETTINGS: the four settings columns are non-null with an
-- empty-string default and are not seeded with values. '' means "not
-- configured" and the invoice picture prints an em dash; issuing is never
-- blocked by missing payment details.

-- Payment details printed on every invoice, configured once by the admin.
-- They stay behind the existing settings_admin_all policy; no public RPC
-- exposes them.
alter table settings
  add column bank_name text not null default '';

alter table settings
  add column account_name text not null default '';

alter table settings
  add column account_number text not null default '';

alter table settings
  add column instagram_handle text not null default '';

-- Frozen invoice snapshots. The row is the document: it is never rewritten
-- (only sent_at and, while unsent, the two dates may change).
create table invoices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  booking_id uuid not null references bookings (id) on delete cascade,
  -- Number allocation bookkeeping: number = invc-NN/YYYY.
  year integer not null,
  seq integer not null check (seq > 0),
  number text not null unique,
  issued_on date not null,
  due_on date not null,
  -- Null until the admin explicitly marks the invoice as sent.
  sent_at timestamptz,
  -- Snapshot copied from the Booking at issue time.
  client_name text not null,
  client_phone text not null,
  service_name text not null default '',
  event_type text not null default '',
  headcount integer not null check (headcount >= 1),
  venue text not null default '',
  hairdo text not null default '',
  booking_date date not null,
  start_time text not null
    check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text not null
    check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  subtotal integer not null check (subtotal >= 0),
  dp_amount integer not null check (dp_amount > 0),
  check (dp_amount <= subtotal),
  check (due_on >= issued_on),
  check (start_time < end_time),
  -- The issue date may move, but never out of the number's year.
  check (year = extract(year from issued_on)::integer),
  check (number = 'invc-' || lpad(seq::text, 2, '0') || '/' || year::text),
  unique (year, seq)
);

-- Per-booking list: newest first (year, sequence).
create index invoices_booking_newest_idx
  on invoices (booking_id, year desc, seq desc);

alter table invoices enable row level security;

-- Admin full CRUD (single-admin model: any authenticated user is the admin).
-- No anon policy exists by design: invoices are never public.
create policy invoices_admin_all on invoices
  for all to authenticated
  using (true) with check (true);

-- Creates one frozen Invoice from a Booking plus its issue and due dates.
-- The booking row is locked while the snapshot is read, then the year is
-- locked for allocation so two simultaneous issues cannot share a sequence.
create or replace function create_invoice(
  p_booking_id uuid,
  p_issued_on date,
  p_due_on date
)
returns invoices
language plpgsql
set search_path = public
as $$
declare
  v_status text;
  v_client_name text;
  v_client_phone text;
  v_service_name text;
  v_event_type text;
  v_headcount integer;
  v_venue text;
  v_hairdo text;
  v_booking_date date;
  v_start_time text;
  v_end_time text;
  v_subtotal integer;
  v_dp_amount integer;
  v_year integer;
  v_seq integer;
  v_invoice invoices;
begin
  if p_issued_on is null then
    raise exception 'Tanggal terbit wajib diisi.';
  end if;
  if p_due_on is null then
    raise exception 'Tanggal jatuh tempo wajib diisi.';
  end if;

  -- The snapshot comes from the booking row itself, never from the caller.
  select b.status,
         b.client_name,
         b.client_phone,
         coalesce(s.name, ''),
         b.event_type,
         b.headcount,
         b.venue,
         b.hairdo,
         b.date,
         b.start_time,
         b.end_time,
         b.total_price,
         b.dp_amount
    into v_status,
         v_client_name,
         v_client_phone,
         v_service_name,
         v_event_type,
         v_headcount,
         v_venue,
         v_hairdo,
         v_booking_date,
         v_start_time,
         v_end_time,
         v_subtotal,
         v_dp_amount
    from bookings b
    left join services s on s.id = b.service_id
   where b.id = p_booking_id
   for update of b;

  if not found then
    raise exception 'Booking tidak ditemukan.';
  end if;

  if v_status = 'cancelled' then
    raise exception 'Invoice tidak dapat dibuat untuk booking yang dibatalkan.';
  end if;

  if v_subtotal is null then
    raise exception 'Booking belum memiliki total yang disepakati.';
  end if;

  if v_dp_amount <= 0 then
    raise exception 'Booking belum memiliki DP yang tercatat.';
  end if;

  if v_dp_amount > v_subtotal then
    raise exception 'DP tidak boleh melebihi total yang disepakati.';
  end if;

  if p_due_on < p_issued_on then
    raise exception 'Tanggal jatuh tempo tidak boleh sebelum tanggal terbit.';
  end if;

  v_year := extract(year from p_issued_on)::integer;

  -- Serialise allocation per year; highest + 1 frees a deleted newest number.
  perform pg_advisory_xact_lock(hashtext('invoices:' || v_year::text));

  select coalesce(max(seq), 0) + 1
    into v_seq
    from invoices
   where year = v_year;

  insert into invoices (
    booking_id,
    year,
    seq,
    number,
    issued_on,
    due_on,
    client_name,
    client_phone,
    service_name,
    event_type,
    headcount,
    venue,
    hairdo,
    booking_date,
    start_time,
    end_time,
    subtotal,
    dp_amount
  )
  values (
    p_booking_id,
    v_year,
    v_seq,
    'invc-' || lpad(v_seq::text, 2, '0') || '/' || v_year::text,
    p_issued_on,
    p_due_on,
    v_client_name,
    v_client_phone,
    v_service_name,
    v_event_type,
    v_headcount,
    v_venue,
    v_hairdo,
    v_booking_date,
    v_start_time,
    v_end_time,
    v_subtotal,
    v_dp_amount
  )
  returning * into v_invoice;

  return v_invoice;
end;
$$;

-- Admin-only RPC: functions default to PUBLIC execute, so revoke it first.
revoke all on function create_invoice(uuid, date, date) from public;
grant execute on function create_invoice(uuid, date, date) to authenticated;
