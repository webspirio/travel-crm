-- Phase 1.6 — RLS on tenants and tenant_users.
--
-- Naming convention: <table>_<action>_<scope>. Per-action policies (not
-- `for all`) wherever using/with-check shapes differ — easier to grep,
-- easier to test in isolation, no overlap-OR surprises with select.
--
-- Helper calls are wrapped in `(select ...)` so the planner can hoist them
-- into an InitPlan that runs once per query rather than once per row. The
-- benefit is largest on Phase 2 tables with many rows; we apply the pattern
-- here for consistency.
--
-- No INSERT/DELETE policy on public.tenants for `authenticated` — tenants
-- are created via service_role (provisioning script). Etap 2 self-serve
-- will add an INSERT policy keyed on a different mechanism.

alter table public.tenants       enable row level security;
alter table public.tenant_users  enable row level security;

-- Members read their own tenant.
create policy tenants_select_members on public.tenants
  for select to authenticated
  using ((select private.has_role_on_tenant(id)));

-- Only owners update tenant settings. `with check` is omitted: the row is
-- the tenant itself, `id` is immutable (tenant_id immutability is enforced
-- by trigger in Phase 2), and `using` already gates the row.
create policy tenants_update_owners on public.tenants
  for update to authenticated
  using ((select private.has_role_on_tenant(id, array['owner']::public.tenant_role[])));

-- Members read their tenant's user list.
create policy tenant_users_select_members on public.tenant_users
  for select to authenticated
  using ((select private.has_role_on_tenant(tenant_id)));

-- Per-action owner policies. `with check` is omitted on UPDATE/DELETE
-- because the row's tenant_id is immutable (assert_tenant_id_immutable
-- attaches in Phase 2) and the using clause already gates the row. INSERT
-- legitimately needs `with check` because there is no OLD row.
create policy tenant_users_insert_owners on public.tenant_users
  for insert to authenticated
  with check ((select private.has_role_on_tenant(tenant_id, array['owner']::public.tenant_role[])));

create policy tenant_users_update_owners on public.tenant_users
  for update to authenticated
  using ((select private.has_role_on_tenant(tenant_id, array['owner']::public.tenant_role[])));

create policy tenant_users_delete_owners on public.tenant_users
  for delete to authenticated
  using ((select private.has_role_on_tenant(tenant_id, array['owner']::public.tenant_role[])));
