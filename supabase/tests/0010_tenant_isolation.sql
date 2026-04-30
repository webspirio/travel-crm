-- Phase 1 tenant isolation test.
-- Helpers are loaded via supabase/seed.sql and only callable as `postgres`.
-- After each impersonation block we revert with `reset role; reset request.jwt.claims`
-- (no helper call) so the tests schema doesn't need to be granted to authenticated.
--
-- Asserts:
--   1. slug normalisation runs in the BEFORE INSERT trigger (lower + collapse + trim).
--   2-4. each owner sees their tenant + members; cross-tenant SELECT returns 0 rows.
--   5. owner can UPDATE own tenant.
--   6. cross-tenant UPDATE silently filtered (zero rows updated).
--   7. manager (non-owner) cannot UPDATE.
--   8-10. agent / accountant / driver impersonations all see the right rows
--          (sentinels for typo'd role names in the SELECT-allow-all policy).
--   11. is_active=false members lose access (sentinel for the helper's
--       `and tu.is_active` clause).
--   12. authenticated session with empty claims sees nothing.

begin;

select plan(12);

-- Fixtures: run as postgres so RLS doesn't block setup.
create temp table _ids (k text primary key, v uuid);
grant select on _ids to authenticated;

insert into _ids values ('tenant_a', tests.make_tenant('Tenant_A!!', 'Tenant A'));
insert into _ids values ('tenant_b', tests.make_tenant('tenant-b',   'Tenant B'));
insert into _ids values ('owner_a',     tests.make_member((select v from _ids where k='tenant_a'), 'owner-a@test.local',     'owner'));
insert into _ids values ('owner_b',     tests.make_member((select v from _ids where k='tenant_b'), 'owner-b@test.local',     'owner'));
insert into _ids values ('manager_a',   tests.make_member((select v from _ids where k='tenant_a'), 'manager-a@test.local',   'manager'));
insert into _ids values ('agent_a',     tests.make_member((select v from _ids where k='tenant_a'), 'agent-a@test.local',     'agent'));
insert into _ids values ('accountant_a',tests.make_member((select v from _ids where k='tenant_a'), 'accountant-a@test.local','accountant'));
insert into _ids values ('driver_a',    tests.make_member((select v from _ids where k='tenant_a'), 'driver-a@test.local',    'driver'));
insert into _ids values ('inactive_a',  tests.make_member((select v from _ids where k='tenant_a'), 'inactive-a@test.local',  'manager', false));

-- 1: slug normalisation (lowercase, collapse runs, trim leading/trailing dashes).
-- Input 'Tenant_A!!' → strip '_' and '!!' to single dashes → 'tenant-a-' → trim → 'tenant-a'.
select is(
  (select slug from public.tenants where id = (select v from _ids where k='tenant_a')),
  'tenant-a',
  'slugify_tenant_slug lowercases, collapses, and trims'
);

-- 2: owner-A sees exactly their tenant.
select tests.impersonate_user('owner-a@test.local');
select results_eq(
  'select count(*)::int from public.tenants',
  $$values (1)$$,
  'owner-a sees exactly one tenant via RLS'
);

-- 3: owner-A sees all 5 active members of tenant A
--    (owner + manager + agent + accountant + driver).
select results_eq(
  'select count(*)::int from public.tenant_users where is_active',
  $$values (5)$$,
  'owner-a sees all 5 active members of tenant A'
);

-- 4: owner-A also sees the inactive member (RLS does not filter on is_active).
select results_eq(
  'select count(*)::int from public.tenant_users',
  $$values (6)$$,
  'owner-a sees inactive member too (RLS does not hide is_active=false)'
);

-- 5: owner-A can UPDATE their own tenant.
update public.tenants set name = 'Tenant A renamed'
  where id = (select v from _ids where k='tenant_a');
reset role; reset request.jwt.claims;
select is(
  (select name from public.tenants where id = (select v from _ids where k='tenant_a')),
  'Tenant A renamed',
  'owner-a can UPDATE their own tenant'
);

-- 6: owner-A cannot UPDATE tenant B; assert zero rows updated AND name unchanged.
select tests.impersonate_user('owner-a@test.local');
do $$
declare
  rc int;
begin
  update public.tenants set name = 'pwned'
    where id = (select v from _ids where k='tenant_b');
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'expected 0 rows updated, got %', rc; end if;
end $$;
reset role; reset request.jwt.claims;
select is(
  (select name from public.tenants where id = (select v from _ids where k='tenant_b')),
  'Tenant B',
  'cross-tenant UPDATE: 0 rows updated, name unchanged'
);

-- 7: manager (non-owner) cannot UPDATE.
select tests.impersonate_user('manager-a@test.local');
do $$
declare
  rc int;
begin
  update public.tenants set name = 'Tenant A by manager'
    where id = (select v from _ids where k='tenant_a');
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'expected 0 rows updated, got %', rc; end if;
end $$;
reset role; reset request.jwt.claims;
select is(
  (select name from public.tenants where id = (select v from _ids where k='tenant_a')),
  'Tenant A renamed',
  'manager cannot UPDATE tenant settings (only owners)'
);

-- 8: agent in tenant A sees their tenant via SELECT (sentinel for typo'd
--    role name in tenants_select_members policy — if the policy used
--    array['ownre'] or omitted agent, this would fail).
select tests.impersonate_user('agent-a@test.local');
select results_eq(
  'select count(*)::int from public.tenants',
  $$values (1)$$,
  'agent sees their tenant via tenants_select_members'
);

-- 9: accountant sees their tenant.
reset role; reset request.jwt.claims;
select tests.impersonate_user('accountant-a@test.local');
select results_eq(
  'select count(*)::int from public.tenants',
  $$values (1)$$,
  'accountant sees their tenant via tenants_select_members'
);

-- 10: driver sees their tenant.
reset role; reset request.jwt.claims;
select tests.impersonate_user('driver-a@test.local');
select results_eq(
  'select count(*)::int from public.tenants',
  $$values (1)$$,
  'driver sees their tenant via tenants_select_members'
);

-- 11: inactive member (is_active=false) loses access — sentinel for the
--     `and tu.is_active` clause inside private.has_role_on_tenant. If that
--     clause were dropped, this returns 1 and the test fails.
reset role; reset request.jwt.claims;
select tests.impersonate_user('inactive-a@test.local');
select results_eq(
  'select count(*)::int from public.tenants',
  $$values (0)$$,
  'inactive member is denied SELECT (helper filters on is_active)'
);

-- 12: authenticated session with empty claims sees nothing.
reset role; reset request.jwt.claims;
set local role authenticated;
set local request.jwt.claims to '';
select results_eq(
  'select count(*)::int from public.tenants',
  $$values (0)$$,
  'authenticated role with empty claims sees zero tenants'
);

select * from finish();

rollback;
