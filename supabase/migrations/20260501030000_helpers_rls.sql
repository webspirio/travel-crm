-- Phase 1.4 — RLS helper functions.
--
-- All helpers in `private` schema, security definer, stable, search_path = ''.
-- Patterns intentional:
--   - `set search_path = ''` (stricter than basejump's `= public`). Function
--     only resolves names it qualifies explicitly. Defends against a
--     malicious caller setting a search_path containing a shadow schema.
--   - `(select auth.uid())` wrapping (Makerkit pattern): pulls auth.uid()
--     into an InitPlan that runs once per query instead of once per row.
--   - `enum_range(null::tenant_role)` as the default for has_role_on_tenant.
--     Auto-tracks enum additions; literal arrays would silently exclude new
--     roles until every callsite was updated.
--   - is_active filter in has_role_on_tenant means deactivated members lose
--     access on their next query, no JWT refresh needed.

-- Returns true if auth.uid() has any of the given roles on the given tenant
-- (and is active). Default _roles = the full enum, i.e. "any active member".
create or replace function private.has_role_on_tenant(
  _tenant_id uuid,
  _roles public.tenant_role[] default pg_catalog.enum_range(null::public.tenant_role)
) returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_users tu
    where tu.tenant_id = _tenant_id
      and tu.user_id   = (select auth.uid())
      and tu.is_active
      and tu.role      = any(_roles)
  );
$$;

-- Returns the set of tenant_ids the current user is an active member of.
-- Used in scope predicates to avoid repeating the sub-select per row.
create or replace function private.current_tenant_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select tu.tenant_id
  from public.tenant_users tu
  where tu.user_id = (select auth.uid())
    and tu.is_active;
$$;

-- Phase 1 stub — returns NULL until Phase 2 replaces the body with a real
-- lookup against public.managers. The stub keeps Phase 1 self-contained
-- (every helper named in the deliverables checklist is callable, no
-- forward-references) while preserving the function signature so Phase 2's
-- bookings_select_scoped policy can be authored without an import order
-- dependency. Phase 2's managers migration does CREATE OR REPLACE on this
-- to swap in the production body.
create or replace function private.current_manager_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select null::uuid;
$$;

-- Generic immutability guard attached as BEFORE UPDATE on every domain
-- table starting Phase 2. Catches the silent-leap case where a multi-tenant
-- member runs UPDATE … SET tenant_id = … (RLS `with check` cannot reference
-- OLD, so the trigger is the only place this invariant can be enforced).
create or replace function private.assert_tenant_id_immutable() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'tenant_id is immutable on %.%', tg_table_schema, tg_table_name
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.has_role_on_tenant(uuid, public.tenant_role[]) from public;
revoke all on function private.current_tenant_ids()  from public;
revoke all on function private.current_manager_id()  from public;

grant execute on function private.has_role_on_tenant(uuid, public.tenant_role[]) to authenticated;
grant execute on function private.current_tenant_ids()  to authenticated;
grant execute on function private.current_manager_id()  to authenticated;
-- assert_tenant_id_immutable is only invoked from triggers; no grant needed.
