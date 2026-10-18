-- 0016_booking_request_rpcs.sql — booking-request-intake ticket 02.
--
-- WHAT: adds the two security-definer functions that are the ONLY way the
-- public touches a Booking Request: get_booking_request(p_token) for the
-- form's read-only context and submit_booking_request(p_token, p_payload)
-- for the client's own fields. Execute is granted to anon (and
-- authenticated); the booking_requests table itself stays anon-denied.
--
-- WHY: the Format Booking link opens a public form, which is this project's
-- first public write path. booking_requests (0015) has no anon policy by
-- design, so both the read and the write go through these functions, which
-- run as the function owner and never expose the raw table.
--
-- PRIVACY CONTRACT: get_booking_request returns only the derived state and,
-- for an OPEN token only, the context the admin already typed on the link
-- (client name, requested date/start/end). It never selects or returns
-- client_phone, notes, total_price, dp_amount, status, accepted_booking_id,
-- the token, or another client's row; a submitted or expired token returns
-- no context so the page can render already-submitted / expired instead.
-- submit_booking_request writes ONLY the client-owned columns (client_name,
-- client_phone, event_type, headcount, venue, hairdo, notes, date,
-- start_time, end_time) plus submitted_at = now(). Price, status, token,
-- accepted_booking_id, and every other timestamp stay admin/bookkeeping-
-- owned. Nothing here changes the calendar seam: no booking is created, and
-- the get_day_schedule / get_month_availability confirmed-only occupancy
-- rule is untouched.
--
-- VALIDATION: the payload is validated fail-closed. It must be a jsonb
-- object; client_name is trimmed non-empty and <= 120 chars; client_phone
-- has >= 9 digits and <= 32 chars; headcount is an integer 1..100;
-- event_type/venue/hairdo/notes are <= 100/200/100/1000 chars; the slot is
-- per-field optional (each of date/start/end may be present alone) with a
-- YYYY-MM-DD date, strict HH:MM times, and start < end only when both times
-- are present. Values are extracted as text and validated with regexes BEFORE
-- any cast, so a malformed payload cannot raise a hard cast exception. The
-- same rules are re-enforced client-side in src/lib/booking-request.ts before
-- the RPC is called.
--
-- RACE SAFETY: the guarded update (where token = p_token and submitted_at
-- is null and expires_at > now()) decides the outcome; a lost race returns
-- already_submitted or expired and writes nothing.

create or replace function get_booking_request(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_client_name text;
  v_expires_at timestamptz;
  v_submitted_at timestamptz;
  v_request_date date;
  v_start_time text;
  v_end_time text;
begin
  -- An empty or unknown token is simply missing: no row, no context.
  if p_token is null or btrim(p_token) = '' then
    return jsonb_build_object(
      'state', 'missing',
      'client_name', null,
      'date', null,
      'start_time', null,
      'end_time', null
    );
  end if;

  select r.client_name, r.expires_at, r.submitted_at,
         r.date, r.start_time, r.end_time
    into v_client_name, v_expires_at, v_submitted_at,
         v_request_date, v_start_time, v_end_time
    from booking_requests r
   where r.token = p_token;

  if not found then
    return jsonb_build_object(
      'state', 'missing',
      'client_name', null,
      'date', null,
      'start_time', null,
      'end_time', null
    );
  end if;

  -- Submitted outranks expired; both hide the context.
  if v_submitted_at is not null then
    return jsonb_build_object(
      'state', 'submitted',
      'client_name', null,
      'date', null,
      'start_time', null,
      'end_time', null
    );
  end if;

  if v_expires_at <= now() then
    return jsonb_build_object(
      'state', 'expired',
      'client_name', null,
      'date', null,
      'start_time', null,
      'end_time', null
    );
  end if;

  return jsonb_build_object(
    'state', 'open',
    'client_name', nullif(btrim(v_client_name), ''),
    'date', to_char(v_request_date, 'YYYY-MM-DD'),
    'start_time', v_start_time,
    'end_time', v_end_time
  );
end;
$$;

-- Public form reads its context through this; raw table stays anon-denied.
grant execute on function get_booking_request(text) to anon, authenticated;

create or replace function submit_booking_request(p_token text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_name text;
  v_client_phone text;
  v_event_type text;
  v_headcount integer;
  v_venue text;
  v_hairdo text;
  v_notes text;
  v_request_date date;
  v_start_time text;
  v_end_time text;
  v_date_text text;
  v_start_text text;
  v_end_text text;
  v_headcount_text text;
  v_expires_at timestamptz;
  v_submitted_at timestamptz;
  v_updated integer;
begin
  -- Fail closed: the payload must be a jsonb object.
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  -- The token decides first: an unknown token never reveals payload rules.
  select r.expires_at, r.submitted_at
    into v_expires_at, v_submitted_at
    from booking_requests r
   where r.token = p_token;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_submitted_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_submitted');
  end if;
  if v_expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  -- Client-owned fields, extracted as text and validated before any cast.
  v_client_name := btrim(coalesce(p_payload ->> 'client_name', ''));
  if v_client_name = '' or char_length(v_client_name) > 120 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  v_client_phone := btrim(coalesce(p_payload ->> 'client_phone', ''));
  if char_length(v_client_phone) > 32
     or char_length(regexp_replace(v_client_phone, '[^0-9]', '', 'g')) < 9 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  v_headcount_text := p_payload ->> 'headcount';
  if v_headcount_text is null or v_headcount_text !~ '^[0-9]+$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;
  v_headcount := v_headcount_text::integer;
  if v_headcount < 1 or v_headcount > 100 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  v_event_type := btrim(coalesce(p_payload ->> 'event_type', ''));
  if char_length(v_event_type) > 100 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  v_venue := btrim(coalesce(p_payload ->> 'venue', ''));
  if char_length(v_venue) > 200 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  v_hairdo := btrim(coalesce(p_payload ->> 'hairdo', ''));
  if char_length(v_hairdo) > 100 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  v_notes := btrim(coalesce(p_payload ->> 'notes', ''));
  if char_length(v_notes) > 1000 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  -- Requested slot is per-field optional: each of date/start/end may be
  -- present alone. A present value must be well-formed, and start < end is
  -- required only when both times are present.
  v_date_text := nullif(btrim(p_payload ->> 'date'), '');
  v_start_text := nullif(btrim(p_payload ->> 'start_time'), '');
  v_end_text := nullif(btrim(p_payload ->> 'end_time'), '');

  if v_date_text is not null then
    if v_date_text !~ '^\d{4}-\d{2}-\d{2}$' then
      return jsonb_build_object('ok', false, 'reason', 'invalid_payload');
    end if;
    -- Cast only after the regex, so an out-of-range value cannot raise.
    begin
      v_request_date := v_date_text::date;
    exception when others then
      return jsonb_build_object('ok', false, 'reason', 'invalid_payload');
    end;
  end if;

  if v_start_text is not null then
    if v_start_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      return jsonb_build_object('ok', false, 'reason', 'invalid_payload');
    end if;
    v_start_time := v_start_text;
  end if;

  if v_end_text is not null then
    if v_end_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      return jsonb_build_object('ok', false, 'reason', 'invalid_payload');
    end if;
    v_end_time := v_end_text;
  end if;

  if v_start_text is not null and v_end_text is not null
     and not (v_start_text < v_end_text) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  -- Guarded write decides the outcome; a lost race writes nothing.
  update booking_requests
     set client_name = v_client_name,
         client_phone = v_client_phone,
         event_type = v_event_type,
         headcount = v_headcount,
         venue = v_venue,
         hairdo = v_hairdo,
         notes = v_notes,
         date = v_request_date,
         start_time = v_start_time,
         end_time = v_end_time,
         submitted_at = now()
   where token = p_token
     and submitted_at is null
     and expires_at > now();

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    -- Re-derive why the guarded update lost, without writing anything.
    select r.submitted_at, r.expires_at
      into v_submitted_at, v_expires_at
      from booking_requests r
     where r.token = p_token;
    if not found then
      return jsonb_build_object('ok', false, 'reason', 'not_found');
    end if;
    if v_submitted_at is not null then
      return jsonb_build_object('ok', false, 'reason', 'already_submitted');
    end if;
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  return jsonb_build_object('ok', true, 'state', 'submitted');
end;
$$;

-- Public form writes its own fields through this; raw table stays anon-denied.
grant execute on function submit_booking_request(text, jsonb) to anon, authenticated;
