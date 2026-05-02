-- Phase 2 — tenant_id immutability.
--
-- private.assert_tenant_id_immutable() is attached as BEFORE UPDATE on
-- every domain table. RLS `with check` cannot reference OLD, so this
-- trigger is the only place the invariant can be enforced.

begin;

select plan(3);

create temp table _ids (k text primary key, v uuid);

do $$
declare r record;
begin
  select tenant_id, owner_manager_id into r from tests.make_tenant_with_owner('imm-a', 'Imm A', 'imm-a@test.local');
  insert into _ids values ('tid_a', r.tenant_id), ('mid_a', r.owner_manager_id);
  select tenant_id, owner_manager_id into r from tests.make_tenant_with_owner('imm-b', 'Imm B', 'imm-b@test.local');
  insert into _ids values ('tid_b', r.tenant_id), ('mid_b', r.owner_manager_id);
end $$;

-- 1: clients UPDATE that flips tenant_id raises.
with new_row as (
  insert into public.clients (tenant_id, first_name, last_name)
values ((select v from _ids where k='tid_a'), 'Imm', 'Client')
returning id
)
insert into _ids select 'client_a', id from new_row;

select throws_ok(
  format(
    $sql$update public.clients set tenant_id = '%s' where id = '%s'$sql$,
    (select v from _ids where k='tid_b'),
    (select v from _ids where k='client_a')
  ),
  '42501',
  null,
  'clients UPDATE that flips tenant_id raises 42501'
);

-- 2: trips UPDATE that flips tenant_id raises 42501.
-- The immutability triggers are named `<table>_aa_assert_tenant_id_immutable`
-- so they sort alphabetically before `<table>_assert_same_tenant` and fire
-- first. Result: 42501 (immutability) raises before P0001 (cross-tenant FK)
-- has a chance, so the user sees a consistent error code regardless of
-- which table they hit.
with new_row as (
  insert into public.trips (
    tenant_id, name, destination, origin, owner_manager_id, bus_type, capacity,
    departure_at, return_at, base_price_eur, child_price_eur
  ) values (
    (select v from _ids where k='tid_a'), 'Imm Trip', 'Rimini', 'Prague',
    (select v from _ids where k='mid_a'), 'bus_55', 4,
    now() + interval '7 days', now() + interval '14 days', 100, 50
  ) returning id
)
insert into _ids select 'trip_a', id from new_row;

select throws_ok(
  format(
    $sql$update public.trips set tenant_id = '%s' where id = '%s'$sql$,
    (select v from _ids where k='tid_b'),
    (select v from _ids where k='trip_a')
  ),
  '42501',
  null,
  'trips UPDATE that flips tenant_id raises 42501 (multi-FK table)'
);

-- 3: managers UPDATE that flips tenant_id raises.
select throws_ok(
  format(
    $sql$update public.managers set tenant_id = '%s' where id = '%s'$sql$,
    (select v from _ids where k='tid_b'),
    (select v from _ids where k='mid_a')
  ),
  '42501',
  null,
  'managers UPDATE that flips tenant_id raises 42501'
);

select * from finish();

rollback;
