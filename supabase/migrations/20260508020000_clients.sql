-- Phase 2.3 — clients table.
--
-- Soft-delete via deleted_at: clients accumulate PII (passport, contact
-- details) that legal/GDPR may require us to retain or purge under specific
-- workflows. A NULL-safe deleted_at lets the app default-hide soft-deleted
-- rows while preserving FK integrity from past bookings. The actual
-- soft-delete RLS pair (members see live, owners additionally see deleted)
-- is created in 20260508900000_domain_rls.sql.
--
-- Email uniqueness is partial-unique on lower(email) where the row is live
-- and email is set. Duplicate detection at booking time matches the Excel
-- workflow (manager pastes email, picker shows existing client).
--
-- nationality is char(2) ISO-3166 alpha-2 (UA, DE, …). Unconstrained;
-- frontend shows a picker but the DB doesn't enforce membership in a list.

create table public.clients (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  first_name            text not null,
  last_name             text not null,
  email                 text,
  phone                 text,
  nationality           char(2),
  birth_date            date,
  passport_number       text,
  passport_expires_on   date,
  address               text,
  notes                 text,
  deleted_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index clients_tenant_id_idx on public.clients(tenant_id);

-- Live-row email uniqueness (per tenant, case-insensitive). Partial so
-- soft-deleted rows don't block re-creation, and so emailless rows are
-- allowed (some Excel-era clients have only a phone).
create unique index clients_tenant_email_uniq
  on public.clients(tenant_id, pg_catalog.lower(email))
  where deleted_at is null and email is not null;

-- Trigram index for fuzzy first/last name search (manager picker UX).
create index clients_name_trgm_idx
  on public.clients
  using gin (((first_name || ' ' || last_name)) public.gin_trgm_ops);

create trigger clients_touch_updated_at
  before update on public.clients
  for each row execute function private.touch_updated_at();

create trigger clients_aa_assert_tenant_id_immutable
  before update on public.clients
  for each row execute function private.assert_tenant_id_immutable();

alter table public.clients enable row level security;

-- Live SELECT, INSERT/UPDATE, DELETE policies are created per the §2.4
-- base shape in 20260508900000_domain_rls.sql (where the soft-delete pair
-- is consolidated alongside bookings). Keeping all RLS policies in one
-- migration makes the role/policy matrix a single grep.
