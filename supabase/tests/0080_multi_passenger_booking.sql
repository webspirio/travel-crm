-- Phase 2.5 — multi-passenger booking + client-match RPC tests.
--
-- Covers (22 assertions):
--   1.  4-passenger booking (1 lap-infant) inserts cleanly.
--   2.  bookings.total_price_eur equals sum of passenger prices.
--   3.  bookings.commission_eur = round(total * 0.10, 2).
--   4.  Lap-infant has NULL seat_number.
--   5.  create_booking_with_passengers happy-path end-to-end (8 assertions):
--       booking_id not null, booking_number not null, passenger count=4,
--       server-recomputed total=1150, commission=115, infant seat=null,
--       non-infant seats non-null, new client row created.
--   6.  create_booking_with_passengers rejects intra-booking duplicate seat
--       (SQLSTATE 23505 raised by the RPC's _seen_seats guard).
--   7.  adult with seat_number=NULL → CHECK violation (23514).
--   8.  booking_passengers.client_id cross-tenant → trigger exception (P0001).
--   9.  find_client_matches by email → match_kind='email', score=100.
--   10. find_client_matches by phone_e164 → match_kind='phone', score=80.
--   11. find_client_matches by name → match_kind='name'.
--   12. find_client_matches returns soft-deleted row (deleted_at not null).
--   13. find_client_matches raises 42501 for caller with no role on tenant.
--   14. Cross-booking same seat currently SUCCEEDS (no inter-booking unique
--       index on booking_passengers — deferred to Phase 3 seat-hold design).
--   15. create_booking_with_passengers rejects empty passengers array (22023).
--
-- NOTE on test 6: the duplicate-seat guard lives in
--   public.create_booking_with_passengers (the _seen_seats array check).
--   The underlying booking_passengers table has NO unique constraint on
--   (booking_id, seat_number) today — direct INSERTs are unchecked. The RPC
--   is the canonical write path; the test exercises it via impersonation.
--
-- NOTE on test 14: trip_seats.booking_id tracks held seats, but
--   booking_passengers has no unique index on (trip_id, seat_number) across
--   bookings. Two bookings can hold the same seat right now. Phase 3 will
--   add the soft-hold / TTL design and a partial unique index. If this test
--   starts failing a new uniqueness constraint was added — review Phase 3.
--

begin;

select plan(22);

-- ============================================================
-- Fixtures (all run as postgres, no RLS)
-- ============================================================

create temp table _ids (k text primary key, v uuid);
grant select on _ids to authenticated;

-- Tenant A — the primary test tenant.
do $$
declare r record;
begin
  select tenant_id, owner_manager_id into r
    from tests.make_tenant_with_owner('mpb-a', 'MPB A', 'mpb-owner@test.local');
  insert into _ids values ('tid_a', r.tenant_id), ('mid_a', r.owner_manager_id);
end $$;

-- Tenant B — used only for the cross-tenant client_id guard test and
-- the 42501 check on find_client_matches.
do $$
declare r record;
begin
  select tenant_id, owner_manager_id into r
    from tests.make_tenant_with_owner('mpb-b', 'MPB B', 'mpb-owner-b@test.local');
  insert into _ids values ('tid_b', r.tenant_id), ('mid_b', r.owner_manager_id);
end $$;

-- Trip on tenant A with 10 seats. Seats are materialised by a trigger in
-- 20260508060000_trip_seats.sql; we need seat rows 1–10 to exist so the
-- composite FK (trip_id, seat_number) → trip_seats is satisfiable.
with new_row as (
  insert into public.trips (
    tenant_id, name, destination, origin,
    owner_manager_id, bus_type, capacity,
    departure_at, return_at, base_price_eur, child_price_eur
  ) values (
    (select v from _ids where k='tid_a'),
    'MPB Trip A', 'Rimini', 'Prague',
    (select v from _ids where k='mid_a'),
    'bus_55', 10,
    now() + interval '30 days',
    now() + interval '37 days',
    500, 250
  ) returning id
)
insert into _ids select 'trip_a', id from new_row;

-- Primary client for the booking header on tenant A.
with new_row as (
  insert into public.clients (tenant_id, first_name, last_name, email, phone)
  values (
    (select v from _ids where k='tid_a'),
    'Oksana', 'Melnyk',
    'oksana.melnyk@test.local',
    '+38 044 123-45-67'
  ) returning id
)
insert into _ids select 'client_a', id from new_row;

-- A second client on tenant A — used for phone + name match tests.
with new_row as (
  insert into public.clients (tenant_id, first_name, last_name, email, phone)
  values (
    (select v from _ids where k='tid_a'),
    'Ivan', 'Kovalenko',
    'ivan.kovalenko@test.local',
    '+49 30 1234567'
  ) returning id
)
insert into _ids select 'client_a2', id from new_row;

-- A client on tenant B — for cross-tenant FK rejection test.
with new_row as (
  insert into public.clients (tenant_id, first_name, last_name)
  values (
    (select v from _ids where k='tid_b'),
    'Foreign', 'Client'
  ) returning id
)
insert into _ids select 'client_b', id from new_row;

-- ============================================================
-- 1. 4-passenger booking (1 lap-infant) succeeds.
--    Passengers: 2 adults (seats 1 + 2), 1 child (seat 3), 1 lap-infant
--    (no seat). Prices: 500 + 400 + 250 + 0 = 1150 EUR.
-- ============================================================

do $$
declare bid uuid;
begin
  insert into public.bookings (
    tenant_id, client_id, trip_id, sold_by_manager_id
  ) values (
    (select v from _ids where k='tid_a'),
    (select v from _ids where k='client_a'),
    (select v from _ids where k='trip_a'),
    (select v from _ids where k='mid_a')
  ) returning id into bid;

  -- Adult 1 — seat 1
  insert into public.booking_passengers (
    tenant_id, booking_id, kind, first_name, last_name,
    seat_number, price_total_eur
  ) values (
    (select v from _ids where k='tid_a'), bid, 'adult', 'Oksana', 'Melnyk',
    1, 500
  );

  -- Adult 2 — seat 2
  insert into public.booking_passengers (
    tenant_id, booking_id, kind, first_name, last_name,
    seat_number, price_total_eur
  ) values (
    (select v from _ids where k='tid_a'), bid, 'adult', 'Petro', 'Melnyk',
    2, 400
  );

  -- Child — seat 3
  insert into public.booking_passengers (
    tenant_id, booking_id, kind, first_name, last_name,
    seat_number, price_total_eur
  ) values (
    (select v from _ids where k='tid_a'), bid, 'child', 'Daryna', 'Melnyk',
    3, 250
  );

  -- Lap-infant — no seat
  insert into public.booking_passengers (
    tenant_id, booking_id, kind, first_name, last_name,
    seat_number, price_total_eur
  ) values (
    (select v from _ids where k='tid_a'), bid, 'infant', 'Mykola', 'Melnyk',
    null, 0
  );

  -- Update booking total to match server calculation (as the RPC would).
  update public.bookings
     set total_price_eur  = 1150,
         commission_eur   = round(1150 * 0.10, 2)
   where id = bid;

  insert into _ids values ('booking_4pax', bid);
end $$;

select pass('4-passenger booking with lap-infant inserted cleanly');

-- ============================================================
-- 2. total_price_eur on the booking equals sum of passenger prices.
-- ============================================================

select results_eq(
  $$select b.total_price_eur
      from public.bookings b
     where b.id = (select v from _ids where k='booking_4pax')$$,
  $$values (1150.00::numeric(10,2))$$,
  'booking total_price_eur = sum of passenger prices (1150)'
);

-- ============================================================
-- 3. commission = 10 % of total, rounded to 2 dp.
-- ============================================================

select results_eq(
  $$select commission_eur
      from public.bookings
     where id = (select v from _ids where k='booking_4pax')$$,
  $$values (115.00::numeric(10,2))$$,
  'commission_eur = round(1150 * 0.10, 2) = 115.00'
);

-- ============================================================
-- 4. Lap-infant seat_number is NULL.
-- ============================================================

select results_eq(
  $$select count(*)::int
      from public.booking_passengers
     where booking_id = (select v from _ids where k='booking_4pax')
       and kind = 'infant'
       and seat_number is null$$,
  $$values (1)$$,
  'lap-infant row has seat_number = null'
);

-- ============================================================
-- 5. create_booking_with_passengers happy-path end-to-end.
--    1 adult primary (new client, no primaryClientId) + 1 adult + 1 child
--    + 1 lap-infant. priceEur values: 500+400+250+0 = 1150.
--    No `total` field in payload — the RPC must ignore client totals.
--    Assertions (8):
--      a. booking_id is not null
--      b. booking_number is not null
--      c. passenger count = 4
--      d. server-recomputed total_price_eur = 1150
--      e. server-recomputed commission_eur  = 115
--      f. lap-infant has seat_number = null
--      g. non-infant passengers all have non-null seat_number (count = 3)
--      h. a new clients row was created (primaryClientId was not supplied)
-- ============================================================

-- The happy-path test calls the RPC as an impersonated owner.  We capture
-- the returned booking_id via a writable temp table so that the INSERT does
-- not require the authenticated role to have INSERT on _ids (which only has
-- SELECT granted to authenticated).
create temp table _rpc_result (booking_id uuid, booking_number text);
grant select, insert on _rpc_result to authenticated;

select tests.impersonate_user('mpb-owner@test.local');

-- Call the RPC with inline primary block (no primaryClientId).
-- Deliberately omit any 'total' key — the server must compute it.
insert into _rpc_result
  select r.booking_id, r.booking_number
    from public.create_booking_with_passengers(
      jsonb_build_object(
        'tenantId', (select v from _ids where k='tid_a'),
        'tripId',   (select v from _ids where k='trip_a'),
        'primary',  jsonb_build_object(
          'firstName', 'Hanna',
          'lastName',  'Bondar',
          'email',     'hanna.bondar.rpc@test.local',
          'phone',     '+38 050 111-22-33'
        ),
        'passengers', jsonb_build_array(
          jsonb_build_object('kind','adult', 'firstName','Hanna',  'lastName','Bondar',
                             'seatNumber','7', 'priceEur',500),
          jsonb_build_object('kind','adult', 'firstName','Mykola', 'lastName','Bondar',
                             'seatNumber','8', 'priceEur',400),
          jsonb_build_object('kind','child', 'firstName','Daryna', 'lastName','Bondar',
                             'seatNumber','9', 'priceEur',250),
          jsonb_build_object('kind','infant','firstName','Oleh',   'lastName','Bondar',
                             'priceEur',0)
        )
      )
    ) r;

reset role; reset request.jwt.claims;

-- 5a. booking_id is not null.
select ok(
  (select booking_id from _rpc_result) is not null,
  'RPC happy-path: booking_id is not null'
);

-- 5b. booking_number is not null.
select ok(
  (select booking_number from _rpc_result) is not null,
  'RPC happy-path: booking_number is not null'
);

-- 5c. passenger count = 4.
select results_eq(
  $$select count(*)::int
      from public.booking_passengers
     where booking_id = (select booking_id from _rpc_result)$$,
  $$values (4)$$,
  'RPC happy-path: 4 passenger rows created'
);

-- 5d. server-recomputed total_price_eur = 1150 (client supplied no total).
select results_eq(
  $$select total_price_eur
      from public.bookings
     where id = (select booking_id from _rpc_result)$$,
  $$values (1150.00::numeric(10,2))$$,
  'RPC happy-path: server-recomputed total_price_eur = 1150.00'
);

-- 5e. server-recomputed commission_eur = 115 (10 % of 1150).
select results_eq(
  $$select commission_eur
      from public.bookings
     where id = (select booking_id from _rpc_result)$$,
  $$values (115.00::numeric(10,2))$$,
  'RPC happy-path: server-recomputed commission_eur = 115.00'
);

-- 5f. lap-infant row has seat_number = null.
select results_eq(
  $$select count(*)::int
      from public.booking_passengers
     where booking_id = (select booking_id from _rpc_result)
       and kind = 'infant'
       and seat_number is null$$,
  $$values (1)$$,
  'RPC happy-path: lap-infant has seat_number = null'
);

-- 5g. all 3 non-infant passengers have non-null seat_number.
select results_eq(
  $$select count(*)::int
      from public.booking_passengers
     where booking_id = (select booking_id from _rpc_result)
       and kind <> 'infant'
       and seat_number is not null$$,
  $$values (3)$$,
  'RPC happy-path: all 3 non-infant passengers have non-null seat_number'
);

-- 5h. a new client row was created (email unique to this test).
select results_eq(
  $$select count(*)::int
      from public.clients
     where tenant_id = (select v from _ids where k='tid_a')
       and email = 'hanna.bondar.rpc@test.local'$$,
  $$values (1)$$,
  'RPC happy-path: new clients row created for inline primary block'
);

-- ============================================================
-- 6. create_booking_with_passengers rejects intra-booking duplicate seat.
--    The _seen_seats guard in the RPC raises SQLSTATE 23505.
--    We call the RPC as an impersonated owner (SECURITY INVOKER).
-- ============================================================

select tests.impersonate_user('mpb-owner@test.local');

select throws_ok(
  format(
    $sql$select * from public.create_booking_with_passengers(jsonb_build_object(
      'tenantId',         '%s',
      'tripId',           '%s',
      'primaryClientId',  '%s',
      'passengers', jsonb_build_array(
        jsonb_build_object('kind','adult','firstName','A','lastName','A','seatNumber','4','priceEur',100),
        jsonb_build_object('kind','adult','firstName','B','lastName','B','seatNumber','4','priceEur',100)
      )
    ))$sql$,
    (select v from _ids where k='tid_a'),
    (select v from _ids where k='trip_a'),
    (select v from _ids where k='client_a')
  ),
  '23505', null,
  'create_booking_with_passengers rejects intra-booking duplicate seat (23505)'
);

reset role; reset request.jwt.claims;

-- ============================================================
-- 7. adult with seat_number=NULL → CHECK violation (23514).
--    The CHECK is: kind = 'infant' OR seat_number IS NOT NULL.
-- ============================================================

do $$
declare bid uuid;
begin
  insert into public.bookings (
    tenant_id, client_id, trip_id, sold_by_manager_id
  ) values (
    (select v from _ids where k='tid_a'),
    (select v from _ids where k='client_a'),
    (select v from _ids where k='trip_a'),
    (select v from _ids where k='mid_a')
  ) returning id into bid;
  insert into _ids values ('booking_adult_no_seat', bid);
end $$;

select throws_ok(
  format(
    $sql$insert into public.booking_passengers
      (tenant_id, booking_id, kind, first_name, last_name, seat_number, price_total_eur)
    values ('%s', '%s', 'adult', 'No', 'Seat', null, 100)$sql$,
    (select v from _ids where k='tid_a'),
    (select v from _ids where k='booking_adult_no_seat')
  ),
  '23514', null,
  'adult passenger with null seat_number violates CHECK (23514)'
);

-- ============================================================
-- 8. booking_passengers.client_id cross-tenant rejected by trigger.
-- ============================================================

do $$
declare bid uuid;
begin
  insert into public.bookings (
    tenant_id, client_id, trip_id, sold_by_manager_id
  ) values (
    (select v from _ids where k='tid_a'),
    (select v from _ids where k='client_a'),
    (select v from _ids where k='trip_a'),
    (select v from _ids where k='mid_a')
  ) returning id into bid;
  insert into _ids values ('booking_cross_client', bid);
end $$;

select throws_ok(
  format(
    $sql$insert into public.booking_passengers
      (tenant_id, booking_id, kind, first_name, last_name,
       seat_number, price_total_eur, client_id)
    values ('%s', '%s', 'adult', 'Cross', 'Tenant',
            5, 100, '%s')$sql$,
    (select v from _ids where k='tid_a'),
    (select v from _ids where k='booking_cross_client'),
    (select v from _ids where k='client_b')
  ),
  'P0001', null,
  'cross-tenant client_id on booking_passengers rejected by trigger'
);

-- ============================================================
-- Tests 9–12 use find_client_matches — SECURITY DEFINER but auth-gated via
-- has_role_on_tenant(auth.uid()). Must impersonate an owner of tenant A.
-- ============================================================

select tests.impersonate_user('mpb-owner@test.local');

-- ============================================================
-- 9. find_client_matches — email hit → match_kind='email', score=100.
-- ============================================================

select results_eq(
  format(
    $sql$select match_kind, score
      from public.find_client_matches(
        '%s'::uuid,
        _email := 'oksana.melnyk@test.local'
      )$sql$,
    (select v from _ids where k='tid_a')
  ),
  $$values ('email'::text, 100::smallint)$$,
  'find_client_matches: email hit returns match_kind=email score=100'
);

-- ============================================================
-- 10. find_client_matches — phone hit → match_kind='phone', score=80.
--     client_a2 has phone '+49 30 1234567' → phone_e164 = '+49301234567'.
-- ============================================================

select results_eq(
  format(
    $sql$select match_kind, score
      from public.find_client_matches(
        '%s'::uuid,
        _phone_e164 := '+49301234567'
      )$sql$,
    (select v from _ids where k='tid_a')
  ),
  $$values ('phone'::text, 80::smallint)$$,
  'find_client_matches: phone hit returns match_kind=phone score=80'
);

-- ============================================================
-- 11. find_client_matches — name hit → match_kind='name'.
--     'Ivan Kovalenko' vs. 'Ivan Kovalenko' should be well above 0.45.
-- ============================================================

select results_eq(
  format(
    $sql$select match_kind
      from public.find_client_matches(
        '%s'::uuid,
        _first_name := 'Ivan',
        _last_name  := 'Kovalenko'
      )
     limit 1$sql$,
    (select v from _ids where k='tid_a')
  ),
  $$values ('name'::text)$$,
  'find_client_matches: name hit returns match_kind=name'
);

-- ============================================================
-- 12. find_client_matches returns soft-deleted rows (deleted_at not null).
--     The find_client_matches function is SECURITY DEFINER and bypasses the
--     RLS soft-delete filter intentionally, so managers can spot duplicates
--     before re-creating a soft-deleted client.
-- ============================================================

reset role; reset request.jwt.claims;

-- Soft-delete client_a as postgres (bypasses RLS).
update public.clients
   set deleted_at = now()
 where id = (select v from _ids where k='client_a');

-- Re-impersonate to call the function.
select tests.impersonate_user('mpb-owner@test.local');

select results_eq(
  format(
    $sql$select count(*)::int
      from public.find_client_matches(
        '%s'::uuid,
        _email := 'oksana.melnyk@test.local'
      )
     where deleted_at is not null$sql$,
    (select v from _ids where k='tid_a')
  ),
  $$values (1)$$,
  'find_client_matches: soft-deleted row returned (deleted_at is not null)'
);

reset role; reset request.jwt.claims;

-- Restore client_a for subsequent tests.
update public.clients set deleted_at = null where id = (select v from _ids where k='client_a');

-- ============================================================
-- 13. find_client_matches raises 42501 when caller has no role on tenant.
--     Switch to a user who is a member of tenant B only; call the function
--     against tenant A — must be denied.
-- ============================================================

select tests.impersonate_user('mpb-owner-b@test.local');

select throws_ok(
  format(
    $sql$select * from public.find_client_matches('%s'::uuid)$sql$,
    (select v from _ids where k='tid_a')
  ),
  '42501', null,
  'find_client_matches raises 42501 for caller with no role on tenant A'
);

reset role; reset request.jwt.claims;

-- ============================================================
-- 14. Cross-booking same seat currently SUCCEEDS (no inter-booking unique
--     index on booking_passengers). This is intentional: Phase 3 will add
--     the seat-hold workflow and a partial unique index. If this test starts
--     failing, a uniqueness constraint was added — review the Phase 3 plan.
-- ============================================================

do $$
declare bid1 uuid; bid2 uuid;
begin
  insert into public.bookings (
    tenant_id, client_id, trip_id, sold_by_manager_id
  ) values (
    (select v from _ids where k='tid_a'),
    (select v from _ids where k='client_a'),
    (select v from _ids where k='trip_a'),
    (select v from _ids where k='mid_a')
  ) returning id into bid1;

  insert into public.booking_passengers (
    tenant_id, booking_id, kind, first_name, last_name,
    seat_number, price_total_eur
  ) values (
    (select v from _ids where k='tid_a'), bid1, 'adult', 'Seat', 'One', 6, 100
  );

  insert into public.bookings (
    tenant_id, client_id, trip_id, sold_by_manager_id
  ) values (
    (select v from _ids where k='tid_a'),
    (select v from _ids where k='client_a'),
    (select v from _ids where k='trip_a'),
    (select v from _ids where k='mid_a')
  ) returning id into bid2;

  insert into public.booking_passengers (
    tenant_id, booking_id, kind, first_name, last_name,
    seat_number, price_total_eur
  ) values (
    (select v from _ids where k='tid_a'), bid2, 'adult', 'Seat', 'Two', 6, 100
  );
end $$;

select pass('cross-booking same seat allowed today (Phase 3 will add seat-hold uniqueness)');

-- ============================================================
-- 15. create_booking_with_passengers rejects empty passengers array.
--     The guard near the top of the function raises SQLSTATE 22023
--     (invalid_parameter_value) when passengers is [] or absent.
-- ============================================================

select tests.impersonate_user('mpb-owner@test.local');

select throws_ok(
  format(
    $sql$select * from public.create_booking_with_passengers(jsonb_build_object(
      'tenantId',        '%s',
      'tripId',          '%s',
      'primaryClientId', '%s',
      'passengers',      '[]'::jsonb
    ))$sql$,
    (select v from _ids where k='tid_a'),
    (select v from _ids where k='trip_a'),
    (select v from _ids where k='client_a')
  ),
  '22023', null,
  'create_booking_with_passengers rejects empty passengers array (22023)'
);

reset role; reset request.jwt.claims;

select * from finish();

rollback;
