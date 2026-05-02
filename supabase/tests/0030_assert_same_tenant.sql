-- Phase 2 — same-tenant FK guard (per-table inline triggers).
--
-- The triggers fire for any user, but the case they protect against is a
-- multi-tenant member writing a row whose tenant_id matches one of their
-- tenants but whose FK row belongs to the other. RLS would let the
-- author tenant_id through; only the per-table same-tenant trigger
-- catches the cross-tenant FK.
--
-- The fastest test path is to bypass RLS (run as postgres) and try the
-- forbidden write directly — the trigger raises regardless of role.

begin;

select plan(4);

create temp table _ids (k text primary key, v uuid);

do $$
declare r record;
begin
  select tenant_id, owner_manager_id into r from tests.make_tenant_with_owner('st-tenant-a', 'ST A', 'st-owner-a@test.local');
  insert into _ids values ('tid_a', r.tenant_id), ('mid_a', r.owner_manager_id);
  select tenant_id, owner_manager_id into r from tests.make_tenant_with_owner('st-tenant-b', 'ST B', 'st-owner-b@test.local');
  insert into _ids values ('tid_b', r.tenant_id), ('mid_b', r.owner_manager_id);
end $$;

-- Seed a client in tenant A.
with new_row as (
  insert into public.clients (tenant_id, first_name, last_name)
values ((select v from _ids where k='tid_a'), 'St', 'ClientA')
returning id
)
insert into _ids select 'client_a', id from new_row;

-- Seed a trip in tenant A.
with new_row as (
  insert into public.trips (
tenant_id, name, destination, origin, owner_manager_id, bus_type, capacity,
departure_at, return_at, base_price_eur, child_price_eur
) values (
(select v from _ids where k='tid_a'), 'ST Trip A', 'Rimini', 'Prague',
(select v from _ids where k='mid_a'), 'bus_55', 4,
now() + interval '7 days', now() + interval '14 days', 100, 50
) returning id
)
insert into _ids select 'trip_a', id from new_row;

-- 1: bookings rejects client from a different tenant.
select throws_like(
  format(
    $sql$insert into public.bookings (tenant_id, client_id, trip_id, sold_by_manager_id)
         values ('%s', '%s', (select v from _ids where k='trip_a'), (select v from _ids where k='mid_a'))$sql$,
    (select v from _ids where k='tid_b'),
    (select v from _ids where k='client_a')
  ),
  'cross-tenant FK: clients%',
  'bookings_assert_same_tenant rejects client_id from a different tenant'
);

-- 2: trips rejects route from a different tenant.
with new_row as (
  insert into public.routes (tenant_id, name)
values ((select v from _ids where k='tid_b'), 'ST Route B')
returning id
)
insert into _ids select 'route_b', id from new_row;

select throws_like(
  format(
    $sql$insert into public.trips (
           tenant_id, name, destination, origin, route_id, owner_manager_id,
           bus_type, capacity, departure_at, return_at, base_price_eur, child_price_eur
         ) values ('%s','foo','rimini','prague','%s','%s','bus_55',4,now(),now() + interval '1 day',100,50)$sql$,
    (select v from _ids where k='tid_a'),
    (select v from _ids where k='route_b'),
    (select v from _ids where k='mid_a')
  ),
  'cross-tenant FK: routes%',
  'trips_assert_same_tenant rejects route_id from a different tenant'
);

-- 3: hotel_blocks rejects hotel from a different tenant.
with new_row as (
  insert into public.hotels (tenant_id, name, city, country)
values ((select v from _ids where k='tid_b'), 'ST Hotel B', 'Rimini', 'IT')
returning id
)
insert into _ids select 'hotel_b', id from new_row;

select throws_like(
  format(
    $sql$insert into public.hotel_blocks (tenant_id, trip_id, hotel_id, room_type, qty_total)
         values ('%s', (select v from _ids where k='trip_a'), '%s', 'double', 5)$sql$,
    (select v from _ids where k='tid_a'),
    (select v from _ids where k='hotel_b')
  ),
  'cross-tenant FK: hotels%',
  'hotel_blocks_assert_same_tenant rejects hotel_id from a different tenant'
);

-- 4: trip_agents rejects manager from a different tenant.
select throws_like(
  format(
    $sql$insert into public.trip_agents (tenant_id, trip_id, manager_id)
         values ('%s', (select v from _ids where k='trip_a'), (select v from _ids where k='mid_b'))$sql$,
    (select v from _ids where k='tid_a')
  ),
  'cross-tenant FK: managers%',
  'trip_agents_assert_same_tenant rejects manager_id from a different tenant'
);

select * from finish();

rollback;
