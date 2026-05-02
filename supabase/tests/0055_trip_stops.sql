-- Phase 2 — trip_stops materialise + realign.
--
-- Materialise on trip INSERT copies route_stops → trip_stops with
-- scheduled_at = trip.departure_at + offset. Per-trip edits to
-- scheduled_at must NOT leak to other trips on the same route.
-- UPDATE OF trips.departure_at re-shifts every trip_stops scheduled_at
-- on that trip by the delta (preserving any per-stop manual edits).

begin;

select plan(5);

create temp table _ids (k text primary key, v uuid);

do $$
declare r record;
begin
  select tenant_id, owner_manager_id into r from tests.make_tenant_with_owner('ts-tenant', 'TS', 'ts-owner@test.local');
  insert into _ids values ('tid', r.tenant_id), ('mid', r.owner_manager_id);
end $$;

with new_row as (
  insert into public.routes (tenant_id, name)
values ((select v from _ids where k='tid'), 'Prague→Rimini')
returning id
)
insert into _ids select 'route', id from new_row;

insert into public.route_stops (tenant_id, route_id, ord, city, time_offset_min)
values
  ((select v from _ids where k='tid'), (select v from _ids where k='route'), 1, 'Prague',     0),
  ((select v from _ids where k='tid'), (select v from _ids where k='route'), 2, 'Nuremberg', 240),
  ((select v from _ids where k='tid'), (select v from _ids where k='route'), 3, 'Munich',    480);

-- Two trips on the same route, departing different days.
with new_row as (
  insert into public.trips (
tenant_id, name, destination, origin, route_id, owner_manager_id, bus_type,
capacity, departure_at, return_at, base_price_eur, child_price_eur
) values (
(select v from _ids where k='tid'), 'Trip 1', 'Rimini', 'Prague',
(select v from _ids where k='route'), (select v from _ids where k='mid'), 'bus_55',
4, '2026-06-01 08:00:00+00', '2026-06-08 08:00:00+00', 100, 50
) returning id
)
insert into _ids select 'trip_1', id from new_row;

with new_row as (
  insert into public.trips (
tenant_id, name, destination, origin, route_id, owner_manager_id, bus_type,
capacity, departure_at, return_at, base_price_eur, child_price_eur
) values (
(select v from _ids where k='tid'), 'Trip 2', 'Rimini', 'Prague',
(select v from _ids where k='route'), (select v from _ids where k='mid'), 'bus_55',
4, '2026-07-01 08:00:00+00', '2026-07-08 08:00:00+00', 100, 50
) returning id
)
insert into _ids select 'trip_2', id from new_row;

-- 1: each trip has 3 trip_stops materialised.
select results_eq(
  $$select count(*)::int from public.trip_stops where trip_id = (select v from _ids where k='trip_1')$$,
  $$values (3)$$,
  'trip 1 has 3 trip_stops materialised from the route'
);

select results_eq(
  $$select count(*)::int from public.trip_stops where trip_id = (select v from _ids where k='trip_2')$$,
  $$values (3)$$,
  'trip 2 has 3 trip_stops materialised from the route'
);

-- 2: per-trip stop time edits do not leak to siblings on the same route.
update public.trip_stops
   set scheduled_at = '2026-06-01 09:30:00+00'
 where trip_id = (select v from _ids where k='trip_1')
   and ord = 1;

select results_eq(
  $$select scheduled_at::text from public.trip_stops where trip_id = (select v from _ids where k='trip_2') and ord = 1$$,
  $$values ('2026-07-01 08:00:00+00'::text)$$,
  'editing trip_1 stop does not leak into trip_2'
);

-- 3: UPDATE trips.departure_at re-aligns all trip_stops scheduled_at by
-- the same delta on that trip only. trip_1 was edited above (stop 1 at
-- 09:30). Shift trip_1 departure_at by +2h. Stops 2 and 3 should shift
-- by +2h. Stop 1 should also shift by +2h (preserving the manual edit
-- relative to departure: 09:30 + 2h = 11:30).
update public.trips set departure_at = '2026-06-01 10:00:00+00'
 where id = (select v from _ids where k='trip_1');

select results_eq(
  $$select scheduled_at::text from public.trip_stops
       where trip_id = (select v from _ids where k='trip_1') and ord = 1$$,
  $$values ('2026-06-01 11:30:00+00'::text)$$,
  'departure_at +2h shifts every stop on the trip by +2h (manual edit preserved)'
);

-- 4: trip 2 is unaffected by trip 1's departure_at change.
select results_eq(
  $$select scheduled_at::text from public.trip_stops
       where trip_id = (select v from _ids where k='trip_2') and ord = 2$$,
  $$values ((to_timestamp('2026-07-01 08:00:00+00','YYYY-MM-DD HH24:MI:SS+00') + interval '4 hours')::text)$$,
  'trip 2 stop 2 unaffected by trip 1 departure shift'
);

select * from finish();

rollback;
