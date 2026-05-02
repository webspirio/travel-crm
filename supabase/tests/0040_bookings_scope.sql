-- Phase 2 — bookings_select_scoped: seller / trip-owner / trip-agent legs
-- + owner+accountant fast path.
--
-- The policy:
--   private.has_role_on_tenant(owner|accountant)
--   OR sold_by_manager_id = current_manager_id(tenant_id)
--   OR trip_id in (private.bookings_visible_trip_ids(tenant_id))
--
-- Setup: one tenant. Three managers (A=trip-owner, B=trip-agent, C=seller).
-- Plus one accountant. One booking sold by C on a trip owned by A with
-- agent B assigned. Plus one unrelated manager D.
-- Each manager should see the booking via exactly one leg of the policy.
-- Manager D should see nothing.

begin;

select plan(6);

create temp table _ids (k text primary key, v uuid);
grant select on _ids to authenticated;

do $$
declare r record;
begin
  select tenant_id, owner_manager_id into r from tests.make_tenant_with_owner('scope-tenant', 'Scope', 'scope-owner@test.local');
  insert into _ids values ('tid', r.tenant_id), ('owner_mid', r.owner_manager_id);
end $$;

insert into _ids values ('mid_a', tests.make_manager((select v from _ids where k='tid'), 'scope-a@test.local', 'manager'));
insert into _ids values ('mid_b', tests.make_manager((select v from _ids where k='tid'), 'scope-b@test.local', 'manager'));
insert into _ids values ('mid_c', tests.make_manager((select v from _ids where k='tid'), 'scope-c@test.local', 'manager'));
insert into _ids values ('mid_d', tests.make_manager((select v from _ids where k='tid'), 'scope-d@test.local', 'manager'));
insert into _ids values ('mid_acc', tests.make_manager((select v from _ids where k='tid'), 'scope-acc@test.local', 'accountant'));

with new_row as (
  insert into public.clients (tenant_id, first_name, last_name)
values ((select v from _ids where k='tid'), 'Scope', 'Client')
returning id
)
insert into _ids select 'client', id from new_row;

-- Trip owned by manager A.
with new_row as (
  insert into public.trips (
tenant_id, name, destination, origin, owner_manager_id, bus_type, capacity,
departure_at, return_at, base_price_eur, child_price_eur
) values (
(select v from _ids where k='tid'), 'Scope Trip', 'Rimini', 'Prague',
(select v from _ids where k='mid_a'), 'bus_55', 4,
now() + interval '7 days', now() + interval '14 days', 100, 50
) returning id
)
insert into _ids select 'trip', id from new_row;

-- Manager B is an agent on the trip.
insert into public.trip_agents (tenant_id, trip_id, manager_id)
values ((select v from _ids where k='tid'), (select v from _ids where k='trip'), (select v from _ids where k='mid_b'));

-- Booking sold by manager C.
with new_row as (
  insert into public.bookings (tenant_id, client_id, trip_id, sold_by_manager_id)
values (
(select v from _ids where k='tid'),
(select v from _ids where k='client'),
(select v from _ids where k='trip'),
(select v from _ids where k='mid_c')
) returning id
)
insert into _ids select 'booking', id from new_row;

-- 1: trip-owner (A) sees the booking via the visible-trip-ids set.
select tests.impersonate_user('scope-a@test.local');
select results_eq(
  $$select count(*)::int from public.bookings where id = (select v from _ids where k='booking')$$,
  $$values (1)$$,
  'trip-owner manager (A) sees the booking via visible-trip-ids'
);

-- 2: trip-agent (B) sees the booking via the visible-trip-ids set.
reset role; reset request.jwt.claims;
select tests.impersonate_user('scope-b@test.local');
select results_eq(
  $$select count(*)::int from public.bookings where id = (select v from _ids where k='booking')$$,
  $$values (1)$$,
  'trip-agent manager (B) sees the booking via visible-trip-ids'
);

-- 3: seller (C) sees the booking via sold_by_manager_id leg.
reset role; reset request.jwt.claims;
select tests.impersonate_user('scope-c@test.local');
select results_eq(
  $$select count(*)::int from public.bookings where id = (select v from _ids where k='booking')$$,
  $$values (1)$$,
  'seller manager (C) sees the booking via sold_by_manager_id'
);

-- 4: unrelated manager (D) sees nothing.
reset role; reset request.jwt.claims;
select tests.impersonate_user('scope-d@test.local');
select results_eq(
  $$select count(*)::int from public.bookings where id = (select v from _ids where k='booking')$$,
  $$values (0)$$,
  'unrelated manager (D) does not see the booking'
);

-- 5: tenant owner sees the booking via the owner+accountant fast path.
reset role; reset request.jwt.claims;
select tests.impersonate_user('scope-owner@test.local');
select results_eq(
  $$select count(*)::int from public.bookings where id = (select v from _ids where k='booking')$$,
  $$values (1)$$,
  'tenant owner sees the booking via owner+accountant fast path'
);

-- 6: accountant sees the booking via the owner+accountant fast path.
reset role; reset request.jwt.claims;
select tests.impersonate_user('scope-acc@test.local');
select results_eq(
  $$select count(*)::int from public.bookings where id = (select v from _ids where k='booking')$$,
  $$values (1)$$,
  'accountant sees the booking via owner+accountant fast path'
);

-- (The helper bookings_visible_trip_ids is exercised via the policies
-- in tests 1-2; we don't call it directly because the private schema is
-- not USAGE-granted to authenticated. The policy machinery binds to the
-- helper at CREATE POLICY time, so tests 1-2 prove correctness.)

select * from finish();

rollback;
