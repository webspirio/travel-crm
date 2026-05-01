-- Phase 2.5 — create_booking_with_passengers RPC.
--
-- Atomic one-shot booking creation: insert a booking + N passenger rows
-- (plus an optional inline client INSERT) in a single call so the React
-- form never has to fire multiple round-trips or coordinate partial-insert
-- rollback.
--
-- Payload shape (JSONB, camelCase keys):
--   tenantId          uuid     — required
--   tripId            uuid     — required
--   primaryClientId   uuid     — supply this OR `primary` block
--   primary           object   — inline client data if primaryClientId absent
--     .firstName      text
--     .lastName       text
--     .email          text?
--     .phone          text?
--     .nationality    char(2)?
--     .birthDate      text?   (ISO-8601)
--   passengers        array    — at least one element
--     [].kind         text     — 'adult' | 'child' | 'infant'
--     [].firstName    text
--     [].lastName     text
--     [].birthDate    text?
--     [].seatNumber   text?    — omit / null for lap-infants
--     [].hotelId      text?
--     [].roomType     text?
--     [].priceEur     numeric  — per-passenger total
--     [].priceBreakdown jsonb?
--     [].clientId     text?    — link passenger to existing client record
--
-- Authorization: SECURITY DEFINER — required because this function calls
-- private.has_role_on_tenant and private.current_manager_id directly in its
-- body.  Although both functions have GRANT EXECUTE to authenticated (see
-- 20260501030000_helpers_rls.sql), Postgres still requires USAGE on the
-- enclosing schema to resolve the qualified name at call-time when the
-- caller's search_path is empty (set search_path = '').  The private schema
-- has no USAGE grant to authenticated (by design — it is an internal
-- namespace).  SECURITY DEFINER lets the function execute under the
-- postgres/owner role, which has the necessary schema visibility.
--
-- The isolation guarantee is not weakened: the explicit has_role_on_tenant
-- pre-flight rejects callers without owner/manager role before any DML,
-- mirroring the bookings_insert_managers and
-- booking_passengers_insert_managers RLS policies
-- (20260508900000_domain_rls.sql).  RLS on those tables provides a
-- second layer of defence should the function ever be called without the
-- pre-flight.
--
-- Server-side subtotal: summed from passenger prices so the backend always
-- validates the total (client-supplied total_price_eur is ignored).
-- Commission: fixed 10 % of subtotal, rounded to 2 decimal places.
--
-- Duplicate seat guard: within this invocation we track seen seat numbers
-- in a smallint array and raise SQLSTATE 23505 before hitting the composite
-- FK, giving a predictable error code the client can present as "duplicate
-- seat in this booking". Cross-booking seat conflicts are NOT enforced by
-- a unique index today (deferred to Phase 3 seat-hold / soft-hold design).

create or replace function public.create_booking_with_passengers(_payload jsonb)
returns table(booking_id uuid, booking_number text)
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  _tenant_id          uuid    := (_payload->>'tenantId')::uuid;
  _manager_id         uuid;
  _client_id          uuid;
  _trip_id            uuid    := (_payload->>'tripId')::uuid;
  _booking_id         uuid;
  _bn                 text;
  _pax                jsonb;
  _seen_seats         smallint[] := array[]::smallint[];
  _server_subtotal    numeric(10,2) := 0;
  _server_commission  numeric(10,2);
begin
  -- Pre-flight authorisation: owner or manager role required.
  if not (select private.has_role_on_tenant(
            _tenant_id,
            array['owner','manager']::public.tenant_role[])) then
    raise exception 'access denied' using errcode = '42501';
  end if;

  _manager_id := private.current_manager_id(_tenant_id);

  -- Guard: passengers must be a non-empty array.
  if jsonb_typeof(_payload->'passengers') is distinct from 'array'
     or jsonb_array_length(_payload->'passengers') = 0 then
    raise exception 'passengers must be a non-empty array'
      using errcode = '22023'; -- invalid_parameter_value
  end if;

  -- Resolve or create the primary client (the booking-level FK client).
  if (_payload->>'primaryClientId') is not null then
    _client_id := (_payload->>'primaryClientId')::uuid;
  else
    insert into public.clients(
      tenant_id,
      first_name,
      last_name,
      email,
      phone,
      nationality,
      birth_date
    ) values (
      _tenant_id,
      _payload->'primary'->>'firstName',
      _payload->'primary'->>'lastName',
      nullif(_payload->'primary'->>'email',    ''),
      nullif(_payload->'primary'->>'phone',    ''),
      _payload->'primary'->>'nationality',
      nullif(_payload->'primary'->>'birthDate','')::date
    )
    returning id into _client_id;
  end if;

  -- Server-side total: sum passenger prices so the stored total is always
  -- authoritative (never trust a client-supplied grand total).
  for _pax in select * from jsonb_array_elements(_payload->'passengers') loop
    _server_subtotal := _server_subtotal + (_pax->>'priceEur')::numeric;
  end loop;
  _server_commission := round(_server_subtotal * 0.10, 2);

  -- Insert the booking header. booking_number is auto-generated by the
  -- bookings_set_booking_number BEFORE INSERT trigger — pass '' to trigger
  -- the allocation path (see 20260508090000_bookings.sql).
  insert into public.bookings(
    tenant_id,
    client_id,
    trip_id,
    sold_by_manager_id,
    booking_number,
    total_price_eur,
    commission_eur
  ) values (
    _tenant_id,
    _client_id,
    _trip_id,
    _manager_id,
    '',
    _server_subtotal,
    _server_commission
  )
  returning id, public.bookings.booking_number into _booking_id, _bn;

  -- Insert passenger rows. trip_id is copied from the parent booking by the
  -- booking_passengers_set_and_assert BEFORE INSERT trigger, so we don't
  -- need to pass it explicitly (NULL is safe; the trigger populates it).
  for _pax in select * from jsonb_array_elements(_payload->'passengers') loop

    -- Intra-booking duplicate seat check. Cross-booking conflicts are NOT
    -- enforced here — that requires a unique partial index which is deferred
    -- to the Phase 3 seat-hold design (see trip_seats.booking_id).
    if (_pax->>'seatNumber') is not null then
      if (_pax->>'seatNumber')::smallint = any(_seen_seats) then
        raise exception 'duplicate seat in same booking: %', _pax->>'seatNumber'
          using errcode = '23505';
      end if;
      _seen_seats := _seen_seats || (_pax->>'seatNumber')::smallint;
    end if;

    insert into public.booking_passengers(
      tenant_id,
      booking_id,
      kind,
      first_name,
      last_name,
      birth_date,
      seat_number,
      hotel_id,
      room_type,
      price_total_eur,
      price_breakdown,
      client_id
    ) values (
      _tenant_id,
      _booking_id,
      (_pax->>'kind')::public.passenger_kind,
      _pax->>'firstName',
      _pax->>'lastName',
      nullif(_pax->>'birthDate',   '')::date,
      nullif(_pax->>'seatNumber',  '')::smallint,
      nullif(_pax->>'hotelId',     '')::uuid,
      nullif(_pax->>'roomType',    '')::public.room_type,
      (_pax->>'priceEur')::numeric,
      coalesce(_pax->'priceBreakdown', '{}'::jsonb),
      nullif(_pax->>'clientId',    '')::uuid
    );
  end loop;

  return query select _booking_id, _bn;
end;
$$;

revoke all on function public.create_booking_with_passengers(jsonb) from public, anon;
grant  execute on function public.create_booking_with_passengers(jsonb) to authenticated;
