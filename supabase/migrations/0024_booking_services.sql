alter table bookings
  add column selected_services jsonb not null default '[]',
  add constraint bookings_multiple_services_total_check check (
    jsonb_array_length(selected_services) < 2 or total_price is not null
  );

update bookings b
   set selected_services = jsonb_build_array(jsonb_build_object('id', s.id, 'name', s.name))
  from services s
 where s.id = b.service_id;

-- Resolve only newly selected IDs. A retained selection can outlive its catalog row.
create function save_booking_service_names()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_previous jsonb := '[]';
  v_missing boolean;
begin
  if tg_op = 'UPDATE' then
    v_previous := old.selected_services;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by position), '[]'),
         coalesce(bool_or(name is null), false)
    into new.selected_services, v_missing
    from (
      select ids.id, ids.position, coalesce(previous.service->>'name', catalog.name) as name
        from (
          select (service->>'id')::uuid as id, min(position) as position
            from jsonb_array_elements(new.selected_services) with ordinality as entries(service, position)
           group by 1
        ) ids
        left join jsonb_array_elements(v_previous) as previous(service)
          on (previous.service->>'id')::uuid = ids.id
        left join services catalog on catalog.id = ids.id
    ) selections;

  if v_missing then
    raise exception 'Layanan yang dipilih tidak ditemukan.';
  end if;
  return new;
end;
$$;

create trigger bookings_save_service_names
  before insert or update of selected_services on bookings
  for each row execute function save_booking_service_names();

alter table invoices
  add column service_names text[] not null default '{}';

-- Copy the frozen value even for Invoices already sent.
alter table invoices disable trigger invoices_guard_lifecycle;
update invoices
   set service_names = array[service_name]
 where service_name <> '';
alter table invoices enable trigger invoices_guard_lifecycle;

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
  v_booking bookings%rowtype;
  v_remaining integer;
  v_year integer;
  v_seq integer;
  v_invoice invoices;
begin
  if p_issued_on is null then
    raise exception 'Tanggal terbit wajib diisi.';
  end if;

  select * into v_booking
    from bookings
   where id = p_booking_id
   for update;

  if not found then
    raise exception 'Booking tidak ditemukan.';
  end if;
  if v_booking.status = 'cancelled' then
    raise exception 'Invoice tidak dapat dibuat untuk booking yang dibatalkan.';
  end if;
  if v_booking.total_price is null then
    raise exception 'Booking belum memiliki total yang disepakati.';
  end if;
  if v_booking.dp_amount = 0 and v_booking.pelunasan_amount is null then
    raise exception 'Booking belum memiliki pembayaran yang tercatat.';
  end if;
  if v_booking.dp_amount > v_booking.total_price then
    raise exception 'DP tidak boleh melebihi total yang disepakati.';
  end if;

  v_remaining := v_booking.total_price - v_booking.dp_amount - coalesce(v_booking.pelunasan_amount, 0);
  if v_remaining > 0 then
    if p_due_on is null then
      raise exception 'Tanggal jatuh tempo wajib diisi.';
    end if;
    if p_due_on < p_issued_on then
      raise exception 'Tanggal jatuh tempo tidak boleh sebelum tanggal terbit.';
    end if;
  end if;

  v_year := extract(year from p_issued_on)::integer;
  perform pg_advisory_xact_lock(hashtext('invoices:' || v_year::text));

  select coalesce(max(seq), 0) + 1 into v_seq
    from invoices
   where year = v_year;

  insert into invoices (
    booking_id, year, seq, number, issued_on, due_on,
    client_name, client_phone, service_names, event_type, headcount, venue, hairdo,
    booking_date, start_time, end_time, subtotal, dp_amount, pelunasan_amount
  )
  values (
    p_booking_id, v_year, v_seq,
    'invc-' || lpad(v_seq::text, greatest(2, length(v_seq::text)), '0') || '/' || v_year::text,
    p_issued_on, case when v_remaining = 0 then null else p_due_on end,
    v_booking.client_name, v_booking.client_phone,
    array(
      select service->>'name'
        from jsonb_array_elements(v_booking.selected_services) with ordinality as entries(service, position)
       order by position
    ),
    v_booking.event_type, v_booking.headcount, v_booking.venue, v_booking.hairdo,
    v_booking.date, v_booking.start_time, v_booking.end_time,
    v_booking.total_price, v_booking.dp_amount, v_booking.pelunasan_amount
  )
  returning * into v_invoice;

  return v_invoice;
end;
$$;

revoke execute on function create_invoice(uuid, date, date) from public, anon;

alter table bookings drop column service_id;
alter table invoices drop column service_name;
