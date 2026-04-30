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

-- 2: hotels UPDATE that flips tenant_id raises 42501.
-- Picked over trips because trips also has trips_assert_same_tenant which
-- fires alphabetically first and masks the immutability trigger (raises
-- P0001 on the FK mismatch instead). hotels has no other trigger
-- competing for the BEFORE UPDATE slot, so we directly observe the
-- immutability trigger's 42501.
with new_row as (
  insert into public.hotels (tenant_id, name, city, country)
  values ((select v from _ids where k='tid_a'), 'Imm Hotel', 'Rimini', 'IT')
  returning id
)
insert into _ids select 'hotel_a', id from new_row;

select throws_ok(
  format(
    $sql$update public.hotels set tenant_id = '%s' where id = '%s'$sql$,
    (select v from _ids where k='tid_b'),
    (select v from _ids where k='hotel_a')
  ),
  '42501',
  null,
  'hotels UPDATE that flips tenant_id raises 42501'
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
