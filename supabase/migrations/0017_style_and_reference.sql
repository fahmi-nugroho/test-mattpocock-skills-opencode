-- 0017_style_and_reference.sql — booking-request-style-and-reference ticket 01.
--
-- WHAT: adds one `reference` column to bookings and to booking_requests, then
-- replaces submit_booking_request so its payload gains an optional `reference`
-- key (<= 300 chars) and its existing `hairdo` key becomes the required Style:
-- exactly 'hijabdo' or 'hairdo'.
--
-- WHY: the client's free-text hairstyle box cannot tell the artist whether the
-- client wears a hijab, and the look a client has in mind has nowhere to live.
-- The Style reuses the column the hairstyle already occupies; the Reference is
-- a link, or a short written description, of the look the client wants, and it
-- travels with the Booking Request. See
-- .scratch/booking-request-style-and-reference/spec.md.
--
-- STYLE (reused column): hairdo stays unconstrained text because it already
-- holds free text on rows that predate this change, so the two-value rule lives
-- in the submit function (and the TS validators), never in a schema CHECK that
-- would collide with that legacy text. '' keeps meaning "not known": only
-- legacy rows and the admin's optional field may hold it. The public submit
-- path refuses a missing, empty, or unrecognised Style as invalid_payload, and
-- the admin's own form/validator are handled in later tickets.
--
-- REFERENCE: text, not null, defaulting to '' on both tables, exactly like the
-- other plain-scalar text columns, so existing rows stay safe and readable. The
-- 300-char cap lives in the submit function (and the TS validators); no new
-- constraint, index, or token-bookkeeping change is added.
--
-- READ CONTRACT: unchanged. get_booking_request is not redefined here, so the
-- Style and the Reference stay client-owned and are never returned to a token
-- holder. The submit SET clause still writes only the client-owned columns plus
-- submitted_at = now().
--
-- RACE SAFETY: the guarded update (where token = p_token and submitted_at is
-- null and expires_at > now()) decides the outcome, exactly as in 0016.

alter table bookings
  add column reference text not null default '';

alter table booking_requests
  add column reference text not null default '';

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
  v_reference text;
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

  -- Style: required, exactly 'hijabdo' or 'hairdo'. Not trimmed, matching the
  -- repo's enum handling (see validateBookingInput's status set): a missing,
  -- empty, or unrecognised value is refused like any other malformed field.
  v_hairdo := coalesce(p_payload ->> 'hairdo', '');
  if v_hairdo not in ('hijabdo', 'hairdo') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  -- Reference: optional; over 300 characters is refused, '' stays ''.
  v_reference := btrim(coalesce(p_payload ->> 'reference', ''));
  if char_length(v_reference) > 300 then
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
         reference = v_reference,
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
