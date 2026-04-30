-- Security + performance advisor cleanup.
--
-- Three groups of fixes, all additive:
--
--   B6. Move pg_trgm and btree_gist from `public` → `extensions` schema.
--       Supabase recommends extensions live outside `public` so the namespace
--       stays clean and operator classes don't shadow application objects.
--       The clients trigram index has to be dropped + re-created because its
--       operator class moves with the extension.
--
--   B7. Revoke default GRANTs from `anon` on every public table.
--       Supabase ships with `anon` granted SELECT on all public tables. RLS
--       denies all rows (our policies are `to authenticated` only), but
--       PostgREST/GraphQL still expose schema introspection to anonymous
--       sessions. Our app never uses `anon` post-login, so we lock it out
--       at the GRANT layer too. Default privileges keep future tables
--       locked down.
--
--   B8. Collapse multiple permissive SELECT policies into one per table.
--       Postgres OR-evaluates every permissive policy for the same role +
--       action on each row read. The soft-delete pair on bookings/clients
--       and the `for all` policy on trip_agents both create overlapping
--       SELECT paths. Combining branches into single OR-shaped policies
--       removes the duplicate evaluation.

-- ============================================================
-- B6 — extensions to the `extensions` schema
-- ============================================================

-- The `extensions` schema is pre-created by Supabase. For local CLI
-- environments we ensure-create it. USAGE is granted broadly so
-- operator classes and functions stay accessible to RLS / triggers.
create schema if not exists extensions;
grant usage on schema extensions to public, anon, authenticated, service_role;

-- The trigram index references public.gin_trgm_ops. The op class moves
-- with the extension, so drop the index first.
drop index if exists public.clients_name_trgm_idx;

-- Move the extensions if they're currently in `public`. Skip the move if
-- they're already in `extensions` (idempotent on local re-runs).
do $$
begin
  if exists (
    select 1
      from pg_extension e
      join pg_namespace n on n.oid = e.extnamespace
     where e.extname = 'pg_trgm' and n.nspname = 'public'
  ) then
    execute 'alter extension pg_trgm set schema extensions';
  end if;

  if exists (
    select 1
      from pg_extension e
      join pg_namespace n on n.oid = e.extnamespace
     where e.extname = 'btree_gist' and n.nspname = 'public'
  ) then
    execute 'alter extension btree_gist set schema extensions';
  end if;
end$$;

-- Re-create the trigram index using the qualified op class.
create index clients_name_trgm_idx
  on public.clients
  using gin (((first_name || ' ' || last_name)) extensions.gin_trgm_ops);

-- ============================================================
-- B7 — revoke default `anon` grants on public schema
-- ============================================================

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all routines  in schema public from anon;

-- Default privileges for future tables/sequences/routines created in public.
-- These attach to the role that issues the CREATE; we set them for postgres
-- (the role our migrations run as).
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on routines  from anon;

-- ============================================================
-- B8 — collapse overlapping permissive SELECT policies
-- ============================================================

-- 8a. clients soft-delete pair → single OR-shaped policy
drop policy if exists clients_select_members         on public.clients;
drop policy if exists clients_select_deleted_owners  on public.clients;

create policy clients_select on public.clients
  for select to authenticated
  using (
    -- Live rows visible to any tenant member.
    (deleted_at is null
       and (select private.has_role_on_tenant(tenant_id)))
    or
    -- Soft-deleted rows visible only to owners (restoration UI).
    (deleted_at is not null
       and (select private.has_role_on_tenant(tenant_id, array['owner']::public.tenant_role[])))
  );

-- 8b. bookings soft-delete pair → single OR-shaped policy
drop policy if exists bookings_select_scoped         on public.bookings;
drop policy if exists bookings_select_deleted_owners on public.bookings;

create policy bookings_select on public.bookings
  for select to authenticated
  using (
    -- Live rows: scoped to seller, trip-owner, trip-agent, or
    -- owner+accountant fast path. private.bookings_visible_trip_ids()
    -- evaluates as InitPlan once per query.
    (deleted_at is null
       and (
         (select private.has_role_on_tenant(tenant_id, array['owner','accountant']::public.tenant_role[]))
         or sold_by_manager_id = (select private.current_manager_id())
         or trip_id in (select private.bookings_visible_trip_ids())
       ))
    or
    -- Soft-deleted rows visible only to owners (restoration UI).
    (deleted_at is not null
       and (select private.has_role_on_tenant(tenant_id, array['owner']::public.tenant_role[])))
  );

-- 8c. trip_agents `for all` → split into INSERT/UPDATE/DELETE so the
--     existing trip_agents_select_members policy is the only SELECT path.
drop policy if exists trip_agents_write_managers on public.trip_agents;

create policy trip_agents_insert_managers on public.trip_agents
  for insert to authenticated
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy trip_agents_update_managers on public.trip_agents
  for update to authenticated
  using      ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])))
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy trip_agents_delete_managers on public.trip_agents
  for delete to authenticated
  using ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));
