-- Phase 1.3 — tenant_users membership table.
--
-- Composite PK (tenant_id, user_id) supports multi-tenant memberships
-- (Webspirio admin, partner-staff cross-membership) without a schema
-- migration later. is_active lets owners soft-deactivate departing staff
-- without breaking FK history on past bookings/audit_log.
--
-- Two indexes:
--   - tenant_users_user_id_idx for the reverse lookup ("which tenants is
--     this user in") used by private.current_tenant_ids().
--   - tenant_users_active_idx is a partial index covering the hot-path
--     active-membership lookup (every RLS check filters where is_active).

create table public.tenant_users (
  -- `id` is a synthetic surrogate alongside the natural composite PK. The
  -- composite (tenant_id, user_id) is the application-meaningful key; `id`
  -- exists so the generic audit_trigger() (which captures `id` and
  -- `tenant_id`) can attach uniformly to every domain table including this
  -- one. Cost: 16 bytes/row at the 4-tenant cap.
  id          uuid not null default gen_random_uuid() unique,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        public.tenant_role not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index tenant_users_user_id_idx on public.tenant_users(user_id);

create index tenant_users_active_idx
  on public.tenant_users(user_id, tenant_id)
  where is_active;
