-- Phase 1.7 — audit_log table + RLS + audit_trigger() function.
--
-- The trigger function exists in Phase 1 but is NOT attached to any table
-- yet. Phase 2's audit-attach migration wires it onto bookings,
-- booking_passengers, payments, clients, and tenant_users (which carries a
-- synthetic `id` column for this purpose; see 20260501020000_tenant_users.sql).
--
-- Volume budget: ~240k rows/year for 4 tenants. Single table + the two
-- indexes is fine until ≥1M rows. Partitioning by created_at monthly is
-- an Etap 2 optimisation triggered by query latency, not row count alone.
--
-- force_rls is NOT enabled. Rationale: the audit_trigger runs as security
-- definer (owner = postgres) and must be able to INSERT bypassing RLS, and
-- the provisioning script runs as service_role which already bypasses.
-- Forcing RLS would require additional carve-outs without adding security.

create table public.audit_log (
  id              bigint generated always as identity primary key,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  actor_user_id   uuid references auth.users(id),
  entity_table    text not null,
  entity_id       uuid not null,
  action          text not null check (action in ('insert','update','delete','truncate')),
  before          jsonb,
  after           jsonb,
  created_at      timestamptz not null default now()
);

create index audit_log_tenant_created_idx on public.audit_log(tenant_id, created_at desc);
create index audit_log_entity_idx         on public.audit_log(tenant_id, entity_table, entity_id);

alter table public.audit_log enable row level security;

-- Owners and accountants read; nobody writes via the API. The only legal
-- writer is private.audit_trigger() running as security definer (attached
-- in Phase 2). No INSERT/UPDATE/DELETE policies exist for `authenticated`
-- — by default, RLS denies any operation that has no matching policy.
create policy audit_log_select_finance on public.audit_log
  for select to authenticated
  using ((select private.has_role_on_tenant(tenant_id, array['owner','accountant']::public.tenant_role[])));

-- The trigger function. Attached in Phase 2 to high-value tables. Each
-- target table MUST have a `uuid id` column — tenant_users carries a
-- synthetic one for this reason.
create or replace function private.audit_trigger() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log
    (tenant_id, actor_user_id, entity_table, entity_id, action, before, after)
  values (
    coalesce(new.tenant_id, old.tenant_id),
    (select auth.uid()),
    tg_table_name,
    coalesce(new.id, old.id),
    pg_catalog.lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;
