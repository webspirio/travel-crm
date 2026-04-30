-- Phase 1.2 — tenant_role enum, tenants table, slugify trigger.
--
-- 5-value enum: owner/manager/agent active in Etap 1; accountant/driver
-- declared so they ride along for free in generated TS types and don't
-- require an ALTER TYPE later (which is painful on hot enums).
--
-- slugify_tenant_slug adapted from
-- .reference/basejump/supabase/migrations/20240414161947_basejump-accounts.sql:109-126
-- (function moved into the private schema; same regex body).

create type public.tenant_role as enum (
  'owner',
  'manager',
  'agent',
  'accountant',
  'driver'
);

create table public.tenants (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  name            text not null,
  is_active       boolean not null default true,
  currency_code   text not null default 'EUR',
  default_locale  text not null default 'uk' check (default_locale in ('uk','de')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create or replace function private.slugify_tenant_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Skip the rewrite if slug is unchanged on UPDATE (prevents silent
  -- normalisation churn on every name edit).
  if tg_op = 'UPDATE' and new.slug is not distinct from old.slug then
    return new;
  end if;

  if new.slug is not null then
    new.slug := pg_catalog.lower(
      pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(new.slug, '[^a-zA-Z0-9-]+', '-', 'g'),
        '-+', '-', 'g'
      )
    );
    new.slug := pg_catalog.btrim(new.slug, '-');
  end if;
  return new;
end;
$$;

create trigger tenants_slugify
  before insert or update on public.tenants
  for each row execute function private.slugify_tenant_slug();
