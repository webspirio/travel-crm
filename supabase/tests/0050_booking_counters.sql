-- Phase 2 — booking_counters: gapless within (tenant, year) under serial
-- INSERTs; per-tenant independence; contract_number set on confirmed
-- transition.
--
-- Concurrency under contention is not exercised by pgTap directly (the
-- single-session test framework can't drive parallel transactions).
-- Transactional behaviour of `INSERT … ON CONFLICT … UPDATE` provides
-- per-row locking — the counter row is the contention point and is
-- updated row-locked, so concurrent INSERTs serialise on it. Phase-3
-- pgbench-driven contention test optional.

begin;

select plan(8);

create temp table _ids (k text primary key, v uuid);

do $$
declare r record;
begin
  select tenant_id, owner_manager_id into r from tests.make_tenant_with_owner('cnt-a', 'Cnt A', 'cnt-a@test.local');
  insert into _ids values ('tid_a', r.tenant_id), ('mid_a', r.owner_manager_id);
  select tenant_id, owner_manager_id into r from tests.make_tenant_with_owner('cnt-b', 'Cnt B', 'cnt-b@test.local');
  insert into _ids values ('tid_b', r.tenant_id), ('mid_b', r.owner_manager_id);
end $$;

with new_row as (
  insert into public.clients (tenant_id, first_name, last_name)
values ((select v from _ids where k='tid_a'), 'Cnt', 'A')
returning id
)
insert into _ids select 'client_a', id from new_row;

with new_row as (
  insert into public.clients (tenant_id, first_name, last_name)
values ((select v from _ids where k='tid_b'), 'Cnt', 'B')
returning id
)
insert into _ids select 'client_b', id from new_row;

with new_row as (
  insert into public.trips (
tenant_id, name, destination, origin, owner_manager_id, bus_type, capacity,
departure_at, return_at, base_price_eur, child_price_eur
) values (
(select v from _ids where k='tid_a'), 'Cnt Trip A', 'Rimini', 'Prague',
(select v from _ids where k='mid_a'), 'bus_55', 10,
now() + interval '7 days', now() + interval '14 days', 100, 50
) returning id
)
insert into _ids select 'trip_a', id from new_row;

with new_row as (
  insert into public.trips (
tenant_id, name, destination, origin, owner_manager_id, bus_type, capacity,
departure_at, return_at, base_price_eur, child_price_eur
) values (
(select v from _ids where k='tid_b'), 'Cnt Trip B', 'Rimini', 'Prague',
(select v from _ids where k='mid_b'), 'bus_55', 10,
now() + interval '7 days', now() + interval '14 days', 100, 50
) returning id
)
insert into _ids select 'trip_b', id from new_row;

-- 1: 5 sequential INSERTs in tenant A produce 5 consecutive booking_numbers.
do $$
declare i int;
begin
  for i in 1..5 loop
    insert into public.bookings (tenant_id, client_id, trip_id, sold_by_manager_id)
    values (
      (select v from _ids where k='tid_a'),
      (select v from _ids where k='client_a'),
      (select v from _ids where k='trip_a'),
      (select v from _ids where k='mid_a')
    );
  end loop;
end $$;

select results_eq(
  $$select array_agg(booking_number order by created_at) from public.bookings where tenant_id = (select v from _ids where k='tid_a')$$,
  $$values (array['26001'::text, '26002', '26003', '26004', '26005'])$$,
  'tenant A booking_numbers are gapless 26001..26005'
);

-- 2: tenant B's counter is independent — first INSERT in tenant B is 26001.
insert into public.bookings (tenant_id, client_id, trip_id, sold_by_manager_id)
values (
  (select v from _ids where k='tid_b'),
  (select v from _ids where k='client_b'),
  (select v from _ids where k='trip_b'),
  (select v from _ids where k='mid_b')
);

select results_eq(
  $$select booking_number from public.bookings where tenant_id = (select v from _ids where k='tid_b')$$,
  $$values ('26001'::text)$$,
  'tenant B counter is independent — first booking is 26001'
);

-- 3: booking_counters has one row per tenant-year (scoped to this test's
-- two tenants — the dev seed adds its own counter row for anytour-dev).
select results_eq(
  $$select count(*)::int from public.booking_counters
       where tenant_id in ((select v from _ids where k='tid_a'),
                           (select v from _ids where k='tid_b'))$$,
  $$values (2)$$,
  'booking_counters has one row per tenant-year (scoped to this test)'
);

-- 4: tenant A counter shows last_seq = 5.
select results_eq(
  $$select last_seq from public.booking_counters where tenant_id = (select v from _ids where k='tid_a')$$,
  $$values (5)$$,
  'tenant A counter last_seq = 5 after 5 INSERTs'
);

-- 5: contract_number is null on draft bookings (scoped to this test's
-- tenants — the dev seed's anytour-dev tenant transitions some bookings
-- to confirmed, which legitimately allocates contract_numbers).
select results_eq(
  $$select count(*)::int from public.bookings
       where contract_number is not null
         and tenant_id in ((select v from _ids where k='tid_a'),
                           (select v from _ids where k='tid_b'))$$,
  $$values (0)$$,
  'no draft bookings have contract_number set (scoped to this test)'
);

-- 6: status = 'confirmed' transition allocates contract_number.
update public.bookings set status = 'confirmed'
 where tenant_id = (select v from _ids where k='tid_a')
   and booking_number = '26001';

select results_eq(
  $$select contract_number from public.bookings where booking_number = '26001' and tenant_id = (select v from _ids where k='tid_a')$$,
  $$values ('26006'::text)$$,
  'confirmed transition allocates next contract_number from same tenant counter'
);

-- 7: tenant A counter advanced to 6 after the contract_number allocation.
select results_eq(
  $$select last_seq from public.booking_counters where tenant_id = (select v from _ids where k='tid_a')$$,
  $$values (6)$$,
  'counter advances on confirmed transition (booking_number + contract_number share the sequence)'
);

-- 8: re-transitioning to confirmed (after partial_paid round-trip) does
-- NOT reallocate contract_number. Simulate: 26001 went confirmed → set
-- partially_paid → flip back. Use a fresh booking to keep the lifecycle
-- legal: status was 'confirmed' (from above), allow confirmed →
-- partially_paid → no further confirmed flip (illegal); use a separate
-- assertion: a confirmed booking with contract_number stays untouched
-- when the trigger re-fires on an unrelated UPDATE.
update public.bookings
   set notes = 'updated', status = 'partially_paid'
 where booking_number = '26001'
   and tenant_id = (select v from _ids where k='tid_a');

select results_eq(
  $$select contract_number from public.bookings where booking_number = '26001' and tenant_id = (select v from _ids where k='tid_a')$$,
  $$values ('26006'::text)$$,
  'contract_number is stable across subsequent status transitions'
);

select * from finish();

rollback;
