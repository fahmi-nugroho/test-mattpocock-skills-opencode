-- Preserve earlier Invoices and Bookings without inferring historic prices.
alter table invoices
  add column service_items jsonb not null default '[]';

create or replace function save_booking_service_names()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_previous jsonb := '[]';
  v_services jsonb := '[]';
  v_selection record;
  v_old_service jsonb;
  v_name text;
  v_pricing jsonb;
  v_unit_price numeric;
  v_quantity numeric;
  v_total numeric := 0;
  v_priced_count integer := 0;
begin
  if tg_op = 'UPDATE' then
    v_previous := old.selected_services;
  end if;

  for v_selection in
    select id, service
      from (
        select distinct on (id) (service->>'id')::uuid as id, service, position
          from jsonb_array_elements(new.selected_services) with ordinality as entries(service, position)
         order by id, position
      ) selections
     order by position
  loop
    select service into v_old_service
      from jsonb_array_elements(v_previous) as previous(service)
     where (service->>'id')::uuid = v_selection.id;
    v_name := v_old_service->>'name';
    if v_name is null then
      select name into v_name from services where id = v_selection.id;
      if not found then
        raise exception 'Layanan yang dipilih tidak ditemukan.';
      end if;
    end if;

    v_pricing := v_selection.service->'pricing';
    if v_pricing is null then
      if v_old_service is null or v_old_service ? 'pricing' then
        raise exception 'Isi harga satuan dan jumlah untuk semua layanan.';
      end if;
    else
      if jsonb_typeof(v_pricing->'unit_price') is distinct from 'number'
        or jsonb_typeof(v_pricing->'quantity') is distinct from 'number' then
        raise exception 'Isi harga satuan dan jumlah untuk semua layanan.';
      end if;
      v_unit_price := (v_pricing->>'unit_price')::numeric;
      v_quantity := (v_pricing->>'quantity')::numeric;
      if v_unit_price not between 0 and 2147483647 or v_unit_price <> trunc(v_unit_price)
        or v_quantity not between 1 and 2147483647 or v_quantity <> trunc(v_quantity) then
        raise exception 'Harga satuan dan jumlah layanan harus berupa angka bulat yang valid.';
      end if;
      v_pricing := jsonb_build_object('unit_price', v_unit_price::integer, 'quantity', v_quantity::integer);
      v_total := v_total + v_unit_price * v_quantity;
      v_priced_count := v_priced_count + 1;
    end if;

    v_services := v_services || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'id', v_selection.id, 'name', v_name, 'pricing', v_pricing
    )));
  end loop;

  if v_priced_count > 0 then
    if v_priced_count <> jsonb_array_length(v_services) then
      raise exception 'Isi harga satuan dan jumlah untuk semua layanan.';
    end if;
    if v_total is distinct from new.total_price then
      raise exception 'Total harga harus sama dengan jumlah rincian layanan.';
    end if;
  end if;

  new.selected_services := v_services;
  return new;
end;
$$;

drop trigger bookings_save_service_names on bookings;
create trigger bookings_save_service_names
  before insert or update of selected_services, total_price on bookings
  for each row execute function save_booking_service_names();

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
    client_name, client_phone, service_names, service_items, event_type, headcount, venue, hairdo,
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
    coalesce((
      select jsonb_agg(jsonb_build_object('name', service->>'name') || (service->'pricing') order by position)
        from jsonb_array_elements(v_booking.selected_services) with ordinality as entries(service, position)
       where service ? 'pricing'
    ), '[]'),
    v_booking.event_type, v_booking.headcount, v_booking.venue, v_booking.hairdo,
    v_booking.date, v_booking.start_time, v_booking.end_time,
    v_booking.total_price, v_booking.dp_amount, v_booking.pelunasan_amount
  )
  returning * into v_invoice;

  return v_invoice;
end;
$$;

revoke execute on function create_invoice(uuid, date, date) from public, anon;
