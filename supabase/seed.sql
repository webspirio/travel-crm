-- Local-dev seed. Runs after migrations on `npm run db:reset` and at the
-- start of every `supabase test db` invocation. NOT deployed to production
-- (only migrations are pushed remote), so this is the right place for
-- test-only extensions and fixture helpers.

create extension if not exists pgtap with schema extensions;

-- ----------------------------------------------------------------------
-- pgTap fixture helpers — defined here (rather than in supabase/tests/)
-- because pg_prove discovers any *.sql under tests/ as a test file.
--
-- Security model: helpers are owned by `postgres` and NOT granted to
-- `authenticated`. Tests invoke `make_tenant`/`make_member` only while
-- the session role is `postgres` (i.e. before role-switching to
-- `authenticated` for RLS assertions). After assertions, tests revert
-- with `reset role; reset request.jwt.claims` — no helper call needed,
-- so no schema USAGE grant to `authenticated` is required.
--
-- Why this matters: a previous design granted execute on these helpers
-- to `authenticated`, which would let any reachable authenticated session
-- promote itself to owner via tests.make_member(...). Locked down here.
-- ----------------------------------------------------------------------

create schema if not exists tests;
revoke all on schema tests from public, anon, authenticated;

-- Switch the current session to `authenticated` and pretend to be the
-- given email. RLS policies that call auth.uid() will see this user's id.
-- Reset by issuing `reset role; reset request.jwt.claims` (no helper).
create or replace function tests.impersonate_user(_email text)
returns void
language plpgsql
as $$
declare
  uid uuid;
  claims jsonb;
begin
  select id into uid from auth.users where email = _email;
  if uid is null then
    raise exception 'tests.impersonate_user: no auth.users row for email=%', _email;
  end if;
  claims := jsonb_build_object('sub', uid::text, 'role', 'authenticated');
  perform set_config('request.jwt.claims', claims::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Insert a tenants row and return its id. Slug normalisation runs in the
-- BEFORE INSERT trigger.
create or replace function tests.make_tenant(_slug text, _name text)
returns uuid
language plpgsql
as $$
declare
  tid uuid;
begin
  insert into public.tenants (slug, name) values (_slug, _name) returning id into tid;
  return tid;
end;
$$;

-- Create an auth.users row and a tenant_users membership. Returns the
-- new user's uuid. Direct insert into auth.users (skipping GoTrue) is
-- safe inside a test transaction — the data is rolled back. The column
-- list is dependent on Supabase's auth.users schema; CLI upgrades that
-- add NOT NULL columns may break this — re-sync from auth.users \d if so.
create or replace function tests.make_member(
  _tenant_id uuid,
  _email text,
  _role public.tenant_role,
  _is_active boolean default true
) returns uuid
language plpgsql
as $$
declare
  uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', _email, crypt('test-password', gen_salt('bf')), now(), now(), now());

  insert into public.tenant_users (tenant_id, user_id, role, is_active)
  values (_tenant_id, uid, _role, _is_active);

  return uid;
end;
$$;

-- Create an auth.users row + tenant_users membership + managers row in
-- one shot, returning the managers.id. Used by Phase 2 tests that need a
-- manager for FK targets (bookings.sold_by_manager_id, trips.owner_manager_id).
create or replace function tests.make_manager(
  _tenant_id uuid,
  _email text,
  _role public.tenant_role default 'manager',
  _display_name text default null
) returns uuid
language plpgsql
as $$
declare
  uid uuid;
  mid uuid;
begin
  uid := tests.make_member(_tenant_id, _email, _role, true);
  insert into public.managers (tenant_id, user_id, display_name, email)
  values (_tenant_id, uid, coalesce(_display_name, split_part(_email, '@', 1)), _email)
  returning id into mid;
  return mid;
end;
$$;

-- Create a tenant + owner-membership + manager row in one shot, returning
-- the new manager_id. Convenience for tests that don't care about the
-- intermediate ids.
create or replace function tests.make_tenant_with_owner(
  _slug text,
  _name text,
  _owner_email text
) returns table (tenant_id uuid, owner_manager_id uuid)
language plpgsql
as $$
declare
  tid uuid;
  mid uuid;
begin
  tid := tests.make_tenant(_slug, _name);
  mid := tests.make_manager(tid, _owner_email, 'owner');
  return query select tid, mid;
end;
$$;
