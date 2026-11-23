alter table bookings
  add column bagian_mua integer,
  add constraint bookings_bagian_mua_check check (
    bagian_mua is null
    or (total_price is not null and bagian_mua between 0 and total_price)
  );

drop function record_pelunasan(uuid, integer, integer, text, text);

create function record_pelunasan(
  p_booking_id uuid,
  p_expected_total integer,
  p_expected_dp integer,
  p_expected_client_name text,
  p_expected_client_phone text,
  p_expected_bagian_mua integer,
  p_bagian_mua integer
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
  if v_booking.bagian_mua is distinct from p_expected_bagian_mua then
    raise exception 'Bagian MUA berubah. Periksa kembali sebelum mencatat pelunasan.';
  end if;

  v_remaining := v_booking.total_price - v_booking.dp_amount;
  if v_remaining is null or v_remaining <= 0 then
    raise exception 'Booking tidak memiliki sisa pembayaran yang dapat dilunasi.';
  end if;

  update bookings
     set pelunasan_amount = v_remaining,
         bagian_mua = p_bagian_mua
   where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function record_pelunasan(uuid, integer, integer, text, text, integer, integer) from public, anon;
grant execute on function record_pelunasan(uuid, integer, integer, text, text, integer, integer) to authenticated;
