-- Phase 1 audit_trigger end-to-end test.
-- Catches column-resolution errors in private.audit_trigger() before Phase 2
-- attaches it to real domain tables. Specifically:
--   - the trigger writes (select auth.uid()) and unqualified-via-pg_catalog
--     functions correctly under search_path = ''
--   - to_jsonb(old) / to_jsonb(new) / coalesce / lower(tg_op) all resolve
--   - INSERT / UPDATE / DELETE all produce the expected audit_log row shape
--   - tenant_id and id are captured from the target row

begin;

select plan(8);

create temp table _ids (k text primary key, v uuid);
insert into _ids values ('tid',   tests.make_tenant('audit-trig', 'Audit Trig'));
insert into _ids values ('owner', tests.make_member((select v from _ids where k='tid'), 'trig-owner@test.local', 'owner'));

-- Build a stand-in domain table the trigger can latch onto. Must have
-- both `id uuid` and `tenant_id uuid` because the trigger captures both.
create table public._audit_target (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  payload     text
);

create trigger _audit_target_audit
  after insert or update or delete on public._audit_target
  for each row execute function private.audit_trigger();

-- 1: INSERT writes an audit row with action='insert'.
insert into public._audit_target (tenant_id, payload)
select (select v from _ids where k='tid'), 'hello'
returning id;

select results_eq(
  $$select count(*)::int from public.audit_log where entity_table = '_audit_target' and action = 'insert'$$,
  $$values (1)$$,
  'INSERT writes one audit row with action=insert'
);

-- 2: insert audit row has after JSONB populated and before NULL.
select results_eq(
  $$select before is null and (after->>'payload') = 'hello'
      from public.audit_log
     where entity_table = '_audit_target' and action = 'insert'$$,
  $$values (true)$$,
  'INSERT audit row: before is null, after.payload = hello'
);

-- 3: tenant_id captured from NEW.tenant_id.
select results_eq(
  format(
    $$select tenant_id from public.audit_log where entity_table = '_audit_target' and action = 'insert' limit 1$$
  ),
  format($$values (%L::uuid)$$, (select v from _ids where k='tid')),
  'INSERT audit row: tenant_id captured from NEW.tenant_id'
);

-- 4: entity_id captured from NEW.id.
select results_eq(
  $$select (select id from public._audit_target limit 1) =
           (select entity_id from public.audit_log
              where entity_table = '_audit_target' and action = 'insert' limit 1)$$,
  $$values (true)$$,
  'INSERT audit row: entity_id captured from NEW.id'
);

-- 5: UPDATE writes a second audit row with action='update', before+after both set.
update public._audit_target set payload = 'updated';

select results_eq(
  $$select count(*)::int from public.audit_log where entity_table = '_audit_target' and action = 'update'$$,
  $$values (1)$$,
  'UPDATE writes one audit row with action=update'
);

select results_eq(
  $$select (before->>'payload') = 'hello' and (after->>'payload') = 'updated'
      from public.audit_log
     where entity_table = '_audit_target' and action = 'update'$$,
  $$values (true)$$,
  'UPDATE audit row: before.payload = hello, after.payload = updated'
);

-- 6: DELETE writes audit row with after NULL, before populated.
delete from public._audit_target;

select results_eq(
  $$select count(*)::int from public.audit_log where entity_table = '_audit_target' and action = 'delete'$$,
  $$values (1)$$,
  'DELETE writes one audit row with action=delete'
);

select results_eq(
  $$select after is null and (before->>'payload') = 'updated'
      from public.audit_log
     where entity_table = '_audit_target' and action = 'delete'$$,
  $$values (true)$$,
  'DELETE audit row: after is null, before.payload = updated'
);

select * from finish();

rollback;
