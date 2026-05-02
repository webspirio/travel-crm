-- Phase 1 audit_log RLS test.
-- Helpers loaded via supabase/seed.sql; role switches use reset role
-- (no helper schema USAGE granted to authenticated).
--
-- The audit_trigger() function is exercised end-to-end in 0020_audit_trigger.sql.
-- This file only exercises the table's RLS shape:
--   1. an owner can SELECT audit_log rows for their tenant.
--   2. an accountant can SELECT (Etap 2 role; policy includes them).
--   3. a manager cannot SELECT (no matching policy).
--   4. an authenticated session cannot INSERT (no INSERT policy at all).
--   5. the action check accepts 'truncate' (round-2 cleanup).

begin;

select plan(5);

create temp table _ids (k text primary key, v uuid);
grant select on _ids to authenticated;

insert into _ids values ('tid', tests.make_tenant('audit-tenant', 'Audit Tenant'));
insert into _ids values ('owner', tests.make_member((select v from _ids where k='tid'), 'audit-owner@test.local', 'owner'));
insert into _ids values ('mgr',   tests.make_member((select v from _ids where k='tid'), 'audit-mgr@test.local',   'manager'));
insert into _ids values ('acc',   tests.make_member((select v from _ids where k='tid'), 'audit-acc@test.local',   'accountant'));

-- Seed an audit row directly as postgres (simulating the trigger writing
-- through `security definer` once it's attached in Phase 2). Phase 2 also
-- attaches audit_trigger to tenant_users — make_member calls above each
-- generated their own audit_log row. We filter on entity_table = 'tenants'
-- so the assertions only see the manually-seeded row, keeping the test's
-- intent (RLS shape) independent of fixture noise.
insert into public.audit_log (tenant_id, actor_user_id, entity_table, entity_id, action, after)
select
  (select v from _ids where k='tid'),
  (select v from _ids where k='owner'),
  'tenants',
  (select v from _ids where k='tid'),
  'insert',
  jsonb_build_object('name', 'Audit Tenant');

-- 1: owner sees the seeded tenants row.
select tests.impersonate_user('audit-owner@test.local');
select results_eq(
  $$select count(*)::int from public.audit_log where entity_table = 'tenants'$$,
  $$values (1)$$,
  'owner can SELECT audit_log rows for their tenant'
);

-- 2: accountant sees the seeded tenants row.
reset role; reset request.jwt.claims;
select tests.impersonate_user('audit-acc@test.local');
select results_eq(
  $$select count(*)::int from public.audit_log where entity_table = 'tenants'$$,
  $$values (1)$$,
  'accountant can SELECT audit_log rows for their tenant'
);

-- 3: manager sees nothing.
reset role; reset request.jwt.claims;
select tests.impersonate_user('audit-mgr@test.local');
select results_eq(
  'select count(*)::int from public.audit_log',
  $$values (0)$$,
  'manager cannot SELECT audit_log (RLS denies — no matching policy)'
);

-- 4: authenticated INSERT raises 42501 (RLS denies — no INSERT policy).
reset role; reset request.jwt.claims;
select tests.impersonate_user('audit-owner@test.local');
select throws_ok(
  $sql$insert into public.audit_log (tenant_id, entity_table, entity_id, action)
       values ((select v from _ids where k='tid'), 'x', (select v from _ids where k='tid'), 'insert')$sql$,
  '42501',
  null,
  'authenticated session cannot INSERT into audit_log (no policy)'
);

-- 5: truncate is a valid action value (run as postgres bypassing RLS).
reset role; reset request.jwt.claims;
insert into public.audit_log (tenant_id, entity_table, entity_id, action)
select (select v from _ids where k='tid'), 'tenants', (select v from _ids where k='tid'), 'truncate';
select pass('action check accepts truncate');

select * from finish();

rollback;
