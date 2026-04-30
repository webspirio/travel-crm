-- Phase 2 cross-tenant SELECT isolation — domain tables.
--
-- The base RLS shape (select_members using has_role_on_tenant) is already
-- exercised generically by 0010_tenant_isolation.sql. This file picks
-- representative domain tables (one per RLS shape) and confirms a member
-- of tenant B cannot see tenant A's rows.
--
-- Coverage:
--   1. managers — base shape (members SELECT all).
--   2. clients  — base shape with soft-delete (members see live only).
--   3. trips    — base shape; tests routes/hotels/route_stops by extension.
--   4. bookings — bookings_select_scoped (the most complex policy).

begin;

select plan(8);

create temp table _ids (k text primary key, v uuid);
grant select on _ids to authenticated;

do $$
declare r record;
begin
  select tenant_id, owner_manager_id into r from tests.make_tenant_with_owner('iso-tenant-a','Iso Tenant A','owner-iso-a@test.local');
  insert into _ids values ('tid_a', r.tenant_id), ('mid_a', r.owner_manager_id);
  select tenant_id, owner_manager_id into r from tests.make_tenant_with_owner('iso-tenant-b','Iso Tenant B','owner-iso-b@test.local');
  insert into _ids values ('tid_b', r.tenant_id), ('mid_b', r.owner_manager_id);
end $$;

-- Add a manager (non-owner) to tenant B for impersonation.
insert into _ids values ('mgr_b', tests.make_manager((select v from _ids where k='tid_b'), 'mgr-iso-b@test.local', 'manager'));

-- Seed one row per audited table in tenant A.
insert into public.clients (tenant_id, first_name, last_name)
  values ((select v from _ids where k='tid_a'), 'Anna', 'Iso');

-- Seed a route + a trip in tenant A.
with new_row as (
  insert into public.routes (tenant_id, name)
values ((select v from _ids where k='tid_a'), 'Iso Route')
returning id
)
insert into _ids select 'route_a', id from new_row;

with new_row as (
  insert into public.trips (
tenant_id, name, destination, origin, owner_manager_id, bus_type, capacity,
departure_at, return_at, base_price_eur, child_price_eur
) values (
(select v from _ids where k='tid_a'), 'Iso Trip A', 'Rimini', 'Prague',
(select v from _ids where k='mid_a'), 'bus_55', 4,
now() + interval '7 days', now() + interval '14 days', 100, 50
) returning id
)
insert into _ids select 'trip_a', id from new_row;

insert into _ids select 'client_a', id from public.clients where tenant_id = (select v from _ids where k='tid_a') limit 1;

-- A booking by tenant A's owner.
insert into public.bookings (tenant_id, client_id, trip_id, sold_by_manager_id)
  values (
    (select v from _ids where k='tid_a'),
    (select v from _ids where k='client_a'),
    (select v from _ids where k='trip_a'),
    (select v from _ids where k='mid_a')
  );

-- 1: tenant B owner sees zero managers from tenant A.
select tests.impersonate_user('owner-iso-b@test.local');
select results_eq(
  $$select count(*)::int from public.managers where tenant_id = (select v from _ids where k='tid_a')$$,
  $$values (0)$$,
  'tenant B owner sees zero managers from tenant A'
);

-- 2: tenant B manager sees zero clients from tenant A.
reset role; reset request.jwt.claims;
select tests.impersonate_user('mgr-iso-b@test.local');
select results_eq(
  $$select count(*)::int from public.clients where tenant_id = (select v from _ids where k='tid_a')$$,
  $$values (0)$$,
  'tenant B manager sees zero clients from tenant A'
);

-- 3: tenant B manager sees zero routes from tenant A.
select results_eq(
  $$select count(*)::int from public.routes where tenant_id = (select v from _ids where k='tid_a')$$,
  $$values (0)$$,
  'tenant B manager sees zero routes from tenant A'
);

-- 4: tenant B manager sees zero trips from tenant A.
select results_eq(
  $$select count(*)::int from public.trips where tenant_id = (select v from _ids where k='tid_a')$$,
  $$values (0)$$,
  'tenant B manager sees zero trips from tenant A'
);

-- 5: tenant B manager sees zero trip_seats from tenant A.
select results_eq(
  $$select count(*)::int from public.trip_seats where tenant_id = (select v from _ids where k='tid_a')$$,
  $$values (0)$$,
  'tenant B manager sees zero trip_seats from tenant A'
);

-- 6: tenant B owner sees zero bookings from tenant A (scoped policy denies
-- cross-tenant even for owner of B because has_role_on_tenant(A) is false).
reset role; reset request.jwt.claims;
select tests.impersonate_user('owner-iso-b@test.local');
select results_eq(
  $$select count(*)::int from public.bookings where tenant_id = (select v from _ids where k='tid_a')$$,
  $$values (0)$$,
  'tenant B owner sees zero bookings from tenant A'
);

-- 7: cross-tenant INSERT rejected. Tenant B manager tries to INSERT a
-- client into tenant A — the policy with-check denies (has_role_on_tenant
-- on A is false for this user).
reset role; reset request.jwt.claims;
select tests.impersonate_user('mgr-iso-b@test.local');
select throws_ok(
  format(
    $sql$insert into public.clients (tenant_id, first_name, last_name)
         values ('%s', 'Mallory', 'Cross')$sql$,
    (select v from _ids where k='tid_a')
  ),
  '42501',
  null,
  'cross-tenant INSERT into clients rejected'
);

-- 8: cross-tenant DELETE silently filters (RLS USING returns 0 rows).
reset role; reset request.jwt.claims;
select tests.impersonate_user('owner-iso-b@test.local');
delete from public.clients where tenant_id = (select v from _ids where k='tid_a');
-- RLS made the DELETE see zero rows; tenant A still has its client.
reset role; reset request.jwt.claims;
select results_eq(
  $$select count(*)::int from public.clients where tenant_id = (select v from _ids where k='tid_a')$$,
  $$values (1)$$,
  'cross-tenant DELETE silently filters; tenant A row survives'
);

select * from finish();

rollback;
