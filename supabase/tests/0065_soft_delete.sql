-- Phase 2 — soft-delete RLS pair.
--
-- Live policy: members see rows with deleted_at is null.
-- Owner-only policy: members with role 'owner' additionally see rows
-- with deleted_at is not null. Tested for clients (same shape applies
-- to bookings).

begin;

select plan(4);

create temp table _ids (k text primary key, v uuid);
grant select on _ids to authenticated;

do $$
declare r record;
begin
  select tenant_id, owner_manager_id into r from tests.make_tenant_with_owner('sd', 'SD', 'sd-owner@test.local');
  insert into _ids values ('tid', r.tenant_id), ('mid_owner', r.owner_manager_id);
end $$;

insert into _ids values ('mid_mgr', tests.make_manager((select v from _ids where k='tid'), 'sd-mgr@test.local', 'manager'));

with new_row as (
  insert into public.clients (tenant_id, first_name, last_name)
values ((select v from _ids where k='tid'), 'SD', 'Live')
returning id
)
insert into _ids select 'client_live', id from new_row;

with new_row as (
  insert into public.clients (tenant_id, first_name, last_name, deleted_at)
values ((select v from _ids where k='tid'), 'SD', 'Dead', now())
returning id
)
insert into _ids select 'client_dead', id from new_row;

-- 1: manager sees the live row only.
select tests.impersonate_user('sd-mgr@test.local');
select results_eq(
  $$select count(*)::int from public.clients where last_name in ('Live','Dead')$$,
  $$values (1)$$,
  'manager sees only the live row (deleted_at is null)'
);

-- 2: manager cannot see the soft-deleted row.
select results_eq(
  $$select count(*)::int from public.clients where last_name = 'Dead'$$,
  $$values (0)$$,
  'manager cannot see the soft-deleted row'
);

-- 3: owner sees both rows (live policy + owner-only deleted policy union).
reset role; reset request.jwt.claims;
select tests.impersonate_user('sd-owner@test.local');
select results_eq(
  $$select count(*)::int from public.clients where last_name in ('Live','Dead')$$,
  $$values (2)$$,
  'owner sees both live and soft-deleted rows'
);

-- 4: owner can restore by clearing deleted_at — the row becomes visible
-- to managers via the live policy.
update public.clients set deleted_at = null where last_name = 'Dead';
reset role; reset request.jwt.claims;
select tests.impersonate_user('sd-mgr@test.local');
select results_eq(
  $$select count(*)::int from public.clients where last_name = 'Dead'$$,
  $$values (1)$$,
  'after owner clears deleted_at, manager sees the previously-soft-deleted row'
);

select * from finish();

rollback;
