alter table bookings
  add column pelunasan_amount integer,
  add constraint bookings_pelunasan_check check (
    pelunasan_amount is null
    or (
      total_price is not null
      and pelunasan_amount > 0
      and pelunasan_amount = total_price - dp_amount
    )
  );

create function guard_booking_settled_amounts()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.pelunasan_amount is not null
    and (new.total_price is distinct from old.total_price
      or new.dp_amount is distinct from old.dp_amount) then
    raise exception 'Total dan DP tidak dapat diubah selama pelunasan tercatat.';
  end if;
  return new;
end;
$$;

create trigger bookings_guard_settled_amounts
  before update of total_price, dp_amount on bookings
  for each row execute function guard_booking_settled_amounts();

create function record_pelunasan(
  p_booking_id uuid,
  p_expected_total integer,
  p_expected_dp integer,
  p_expected_client_name text,
  p_expected_client_phone text
)
returns bookings
language plpgsql
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
  v_remaining integer;
begin
  select * into v_booking
    from bookings
   where id = p_booking_id
   for update;

  if not found then
    raise exception 'Booking tidak ditemukan.';
  end if;
  if v_booking.pelunasan_amount is not null then
    raise exception 'Pelunasan sudah tercatat.';
  end if;
  if v_booking.total_price is distinct from p_expected_total
    or v_booking.dp_amount is distinct from p_expected_dp
    or v_booking.client_name is distinct from p_expected_client_name
    or v_booking.client_phone is distinct from p_expected_client_phone then
    raise exception 'Detail booking berubah. Periksa kembali sisa pembayaran.';
  end if;

  v_remaining := v_booking.total_price - v_booking.dp_amount;
  if v_remaining is null or v_remaining <= 0 then
    raise exception 'Booking tidak memiliki sisa pembayaran yang dapat dilunasi.';
  end if;

  update bookings
     set pelunasan_amount = v_remaining
   where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function record_pelunasan(uuid, integer, integer, text, text) from public, anon;
grant execute on function record_pelunasan(uuid, integer, integer, text, text) to authenticated;

alter table invoices
  add column pelunasan_amount integer,
  drop constraint invoices_dp_amount_check,
  alter column due_on drop not null,
  add constraint invoices_payments_check check (
    dp_amount >= 0
    and (dp_amount > 0 or pelunasan_amount is not null)
    and (pelunasan_amount is null
      or (pelunasan_amount > 0 and pelunasan_amount = subtotal - dp_amount))
    and (due_on is not null or coalesce(pelunasan_amount, 0) = subtotal - dp_amount)
  );

-- Preserve numbers already issued under the old check, even if it truncated them.
alter table invoices
  drop constraint invoices_check4,
  add constraint invoices_number_format_check check (
    number = 'invc-' || lpad(seq::text, greatest(2, length(seq::text)), '0') || '/' || year::text
    or (seq >= 100 and number = 'invc-' || lpad(seq::text, 2, '0') || '/' || year::text)
  );

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
  v_booking record;
  v_remaining integer;
  v_year integer;
  v_seq integer;
  v_invoice invoices;
begin
  if p_issued_on is null then
    raise exception 'Tanggal terbit wajib diisi.';
  end if;

  select b.*, coalesce(s.name, '') as service_name
    into v_booking
    from bookings b
    left join services s on s.id = b.service_id
   where b.id = p_booking_id
   for update of b;

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
    client_name, client_phone, service_name, event_type, headcount, venue, hairdo,
    booking_date, start_time, end_time, subtotal, dp_amount, pelunasan_amount
  )
  values (
    p_booking_id, v_year, v_seq,
    'invc-' || lpad(v_seq::text, greatest(2, length(v_seq::text)), '0') || '/' || v_year::text,
    p_issued_on, case when v_remaining = 0 then null else p_due_on end,
    v_booking.client_name, v_booking.client_phone, v_booking.service_name,
    v_booking.event_type, v_booking.headcount, v_booking.venue, v_booking.hairdo,
    v_booking.date, v_booking.start_time, v_booking.end_time,
    v_booking.total_price, v_booking.dp_amount, v_booking.pelunasan_amount
  )
  returning * into v_invoice;

  return v_invoice;
end;
$$;

create or replace function guard_invoice_lifecycle()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    -- Keep the Booking's foreign-key cascade working for sent Invoices.
    if old.sent_at is not null and pg_trigger_depth() <= 1 then
      raise exception 'Invoice yang sudah dikirim tidak dapat dihapus.';
    end if;
    return old;
  end if;

  if old.sent_at is not null
    and (to_jsonb(new) - 'sent_at') is distinct from (to_jsonb(old) - 'sent_at') then
    raise exception 'Invoice yang sudah dikirim tidak dapat diubah.';
  end if;
  if (new.due_on is null) <> (old.due_on is null) then
    raise exception 'Tanggal jatuh tempo tidak dapat ditambahkan atau dihapus.';
  end if;
  return new;
end;
$$;
