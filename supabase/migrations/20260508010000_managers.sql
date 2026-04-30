-- Phase 2.3 — managers table + swap private.current_manager_id() body.
--
-- `managers` is the per-tenant profile attached to an auth.users row. We
-- keep auth.users as the identity source of truth and managers as the
-- application-level row that domain FKs reference (trips.owner_manager_id,
-- bookings.sold_by_manager_id, …).
--
-- One tenant_users row + one managers row per (tenant, user) is the Etap 1
-- contract. The provisioning script (scripts/provision-tenant.ts) keeps
-- them in sync. No automatic auth.users → managers trigger — explicit
-- creation lets owner setup stay deterministic and easy to test.
--
-- private.current_manager_id() was declared as a stub in Phase 1 (returns
-- NULL) so the bookings_select_scoped policy could be authored without a
-- forward-reference. CREATE OR REPLACE swaps in the production body now
-- that public.managers exists.

create table public.managers (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  display_name    text not null,
  email           text not null,
  phone           text,
  avatar_url      text,
  -- Default commission percentage. Per-trip overrides in trips and
  -- trip_agents take precedence; resolution order is:
  --   coalesce(trip_agents.override_commission_pct,
  --            trips.commission_pct_override,
  --            managers.commission_pct)
  commission_pct  numeric(5,2) not null default 10.00,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- One managers row per (tenant, user). The composite uniqueness lets
  -- the same auth user be a manager in two tenants without colliding —
  -- multi-tenant memberships are a Webspirio admin / partner-staff
  -- affordance, not a Etap 1 user feature, but the schema supports it.
  unique (tenant_id, user_id)
);

create index managers_tenant_id_idx on public.managers(tenant_id);
create index managers_user_id_idx   on public.managers(user_id);

create trigger managers_touch_updated_at
  before update on public.managers
  for each row execute function private.touch_updated_at();

create trigger managers_aa_assert_tenant_id_immutable
  before update on public.managers
  for each row execute function private.assert_tenant_id_immutable();

alter table public.managers enable row level security;

-- RLS policies live in 20260508900000_domain_rls.sql alongside every other
-- domain table's policies — the consolidated migration is the single grep
-- for the role/policy matrix.

-- Swap the Phase-1 stub for the production body. The function is called
-- from bookings_select_scoped and the per-tenant scope of payments /
-- commissions; extracting the lookup into a stable, security-definer
-- function lets the planner evaluate it as an initPlan (once per query)
-- rather than re-running the sub-select per row.
create or replace function private.current_manager_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select id
  from public.managers
  where user_id   = (select auth.uid())
    and is_active
  limit 1;
$$;
