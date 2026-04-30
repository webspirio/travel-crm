-- Phase 2 — public.trip_occupied_seat_numbers RPC + multi-tenant
-- current_manager_id(_tenant_id) scoping.
--
-- The RPC returns occupied seat numbers for a trip regardless of which
-- bookings the caller can read via RLS. Authorization is enforced via
-- has_role_on_tenant — callers must be a member of the trip's tenant.
--
-- Status filter: only 'confirmed', 'partially_paid', 'paid' bookings
-- count as occupying. Cancelled / no_show / draft bookings don't appear.
-- Soft-deleted bookings are excluded.
--
-- The dual-tenant assertion exercises current_manager_id(_tenant_id)
-- through the bookings_select policy: a single auth user who is a
-- manager in two tenants must see the booking they sold in EACH tenant
-- via the seller leg, which only works if current_manager_id resolves
-- to the per-tenant managers row.

begin;

select plan(6);

create temp table _ids (k text primary key, v uuid);
grant select on _ids to authenticated;

-- Tenant A with owner + a manager who has no booking access on the trip.
do $$
declare r record;
begin
  select tenant_id, owner_manager_id into r from tests.make_tenant_with_owner(
    'occ-a', 'Occ A', 'occ-a-owner@test.local'
  );
  insert into _ids values ('tid_a', r.tenant_id), ('mid_a_owner', r.owner_manager_id);
end $$;

insert into _ids values ('mid_a_other', tests.make_manager(
  (select v from _ids where k='tid_a'), 'occ-a-other@test.local', 'manager'
));

-- Tenant B with its own owner.
do $$
declare r record;
begin
  select tenant_id, owner_manager_id into r from tests.make_tenant_with_owner(
    'occ-b', 'Occ B', 'occ-b-owner@test.local'
  );
  insert into _ids values ('tid_b', r.tenant_id), ('mid_b_owner', r.owner_manager_id);
end $$;

-- A user who is a manager in BOTH tenants — current_manager_id(_tenant_id)
-- must resolve to the correct per-tenant managers row.
insert into _ids values ('mid_a_dual', tests.make_manager(
  (select v from _ids where k='tid_a'), 'occ-dual@test.local', 'manager'
));
do $$
declare uid uuid; mid uuid;
begin
  select id into uid from auth.users where email = 'occ-dual@test.local';
  insert into public.tenant_users (tenant_id, user_id, role, is_active)
    values ((select v from _ids where k='tid_b'), uid, 'manager', true);
  insert into public.managers (tenant_id, user_id, display_name, email)
    values ((select v from _ids where k='tid_b'), uid, 'occ-dual', 'occ-dual@test.local')
    returning id into mid;
  insert into _ids values ('mid_b_dual', mid);
end $$;

-- Tenant-A trip with 5 seats + four bookings (draft, confirmed, paid,
-- cancelled). Tenant-B trip with one booking sold by mid_b_dual.
with new_row as (
  insert into public.clients (tenant_id, first_name, last_name)
values ((select v from _ids where k='tid_a'), 'Occ', 'Client')
returning id
)
insert into _ids select 'client_a', id from new_row;

with new_row as (
  insert into public.clients (tenant_id, first_name, last_name)
values ((select v from _ids where k='tid_b'), 'Occ', 'Client B')
returning id
)
insert into _ids select 'client_b', id from new_row;

with new_row as (
  insert into public.trips (
tenant_id, name, destination, origin, owner_manager_id, bus_type, capacity,
departure_at, return_at, base_price_eur, child_price_eur
) values (
(select v from _ids where k='tid_a'), 'Occ Trip A', 'Rimini', 'Prague',
(select v from _ids where k='mid_a_owner'), 'bus_55', 5,
now() + interval '7 days', now() + interval '14 days', 100, 50
) returning id
)
insert into _ids select 'trip_a', id from new_row;

with new_row as (
  insert into public.trips (
tenant_id, name, destination, origin, owner_manager_id, bus_type, capacity,
departure_at, return_at, base_price_eur, child_price_eur
) values (
(select v from _ids where k='tid_b'), 'Occ Trip B', 'Rimini', 'Prague',
(select v from _ids where k='mid_b_owner'), 'bus_55', 5,
now() + interval '7 days', now() + interval '14 days', 100, 50
) returning id
)
insert into _ids select 'trip_b', id from new_row;

-- Tenant A: draft (seat 1), confirmed (seat 2), paid (seat 3), cancelled (seat 4).
do $$
declare draft_id uuid; conf_id uuid; paid_id uuid; canc_id uuid;
begin
  insert into public.bookings (tenant_id, client_id, trip_id, sold_by_manager_id)
    values ((select v from _ids where k='tid_a'), (select v from _ids where k='client_a'),
            (select v from _ids where k='trip_a'), (select v from _ids where k='mid_a_owner'))
    returning id into draft_id;
  insert into public.booking_passengers (tenant_id, booking_id, kind, first_name, last_name, seat_number)
    values ((select v from _ids where k='tid_a'), draft_id, 'adult', 'D', 'D', 1);

  insert into public.bookings (tenant_id, client_id, trip_id, sold_by_manager_id)
    values ((select v from _ids where k='tid_a'), (select v from _ids where k='client_a'),
            (select v from _ids where k='trip_a'), (select v from _ids where k='mid_a_owner'))
    returning id into conf_id;
  insert into public.booking_passengers (tenant_id, booking_id, kind, first_name, last_name, seat_number)
    values ((select v from _ids where k='tid_a'), conf_id, 'adult', 'C', 'C', 2);
  update public.bookings set status='confirmed' where id=conf_id;

  insert into public.bookings (tenant_id, client_id, trip_id, sold_by_manager_id)
    values ((select v from _ids where k='tid_a'), (select v from _ids where k='client_a'),
            (select v from _ids where k='trip_a'), (select v from _ids where k='mid_a_owner'))
    returning id into paid_id;
  insert into public.booking_passengers (tenant_id, booking_id, kind, first_name, last_name, seat_number)
    values ((select v from _ids where k='tid_a'), paid_id, 'adult', 'P', 'P', 3);
  update public.bookings set status='confirmed' where id=paid_id;
  update public.bookings set status='paid'      where id=paid_id;

  insert into public.bookings (tenant_id, client_id, trip_id, sold_by_manager_id)
    values ((select v from _ids where k='tid_a'), (select v from _ids where k='client_a'),
            (select v from _ids where k='trip_a'), (select v from _ids where k='mid_a_owner'))
    returning id into canc_id;
  insert into public.booking_passengers (tenant_id, booking_id, kind, first_name, last_name, seat_number)
    values ((select v from _ids where k='tid_a'), canc_id, 'adult', 'X', 'X', 4);
  update public.bookings set status='cancelled' where id=canc_id;
end $$;

-- Tenant B: one booking sold by mid_b_dual (the dual-tenant user).
with new_row as (
  insert into public.bookings (tenant_id, client_id, trip_id, sold_by_manager_id)
    values ((select v from _ids where k='tid_b'), (select v from _ids where k='client_b'),
            (select v from _ids where k='trip_b'), (select v from _ids where k='mid_b_dual'))
    returning id
)
insert into _ids select 'booking_b_dual', id from new_row;

-- 1: owner sees both occupied seats (2 confirmed, 3 paid) — and only those.
select tests.impersonate_user('occ-a-owner@test.local');
select results_eq(
  $$select array_agg(seat_number order by seat_number)::int[] from public.trip_occupied_seat_numbers((select v from _ids where k='trip_a'))$$,
  $$values (array[2, 3]::int[])$$,
  'owner sees occupied seats {2,3}; draft/cancelled excluded'
);

-- 2: paid flag matches booking status.
select results_eq(
  $$select array_agg(paid order by seat_number) from public.trip_occupied_seat_numbers((select v from _ids where k='trip_a'))$$,
  $$values (array[false, true])$$,
  'paid flag is false for confirmed, true for paid'
);

-- 3: a manager who is NEITHER seller NOR trip-owner NOR trip-agent still
--    sees occupied seats via the RPC (the whole point of Fix 10).
reset role; reset request.jwt.claims;
select tests.impersonate_user('occ-a-other@test.local');
select results_eq(
  $$select array_agg(seat_number order by seat_number)::int[] from public.trip_occupied_seat_numbers((select v from _ids where k='trip_a'))$$,
  $$values (array[2, 3]::int[])$$,
  'unrelated manager (same tenant) still sees occupied seats via RPC'
);

-- 4: a manager from another tenant gets access denied.
reset role; reset request.jwt.claims;
select tests.impersonate_user('occ-b-owner@test.local');
select throws_ok(
  format($sql$select * from public.trip_occupied_seat_numbers('%s')$sql$,
         (select v from _ids where k='trip_a')),
  '42501', null,
  'cross-tenant call to trip_occupied_seat_numbers rejected'
);

-- 5: dual-tenant user sees the booking they sold in tenant B via the
--    seller leg — only correct if current_manager_id(tid_b) resolves to
--    mid_b_dual rather than mid_a_dual.
reset role; reset request.jwt.claims;
select tests.impersonate_user('occ-dual@test.local');
select results_eq(
  $$select count(*)::int from public.bookings where id = (select v from _ids where k='booking_b_dual')$$,
  $$values (1)$$,
  'dual-tenant user sees their tenant-B booking via seller leg (current_manager_id is tenant-scoped)'
);

-- 6: dual-tenant user does NOT see tenant-A bookings (they were sold by
--    mid_a_owner, not mid_a_dual; dual user is not trip-owner or agent).
select results_eq(
  $$select count(*)::int from public.bookings where tenant_id = (select v from _ids where k='tid_a')$$,
  $$values (0)$$,
  'dual-tenant user sees no tenant-A bookings (not seller / owner / agent there)'
);

select * from finish();

rollback;
