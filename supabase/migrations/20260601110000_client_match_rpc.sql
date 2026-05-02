-- Phase 2.5 — find_client_matches RPC.
--
-- Fuzzy client deduplication for the booking form. The manager types an
-- email / phone / name and the RPC returns up to 8 ranked candidate rows
-- so the UI can suggest "use existing client" before creating a duplicate.
--
-- Match tiers (non-exclusive — a row can appear only once, via the highest-
-- priority tier that fires for it):
--   email  — exact case-insensitive email match → score 100
--   phone  — exact phone_e164 match (digit-canonical) → score 80
--   name   — trigram similarity > 0.45 on full name → score 0–60
--
-- The function is SECURITY DEFINER so the similarity search can bypass the
-- clients RLS soft-delete filter (we want to surface soft-deleted duplicates
-- so the manager can restore instead of re-creating). The has_role_on_tenant
-- guard keeps cross-tenant calls out.
--
-- pg_trgm was moved to the `extensions` schema by migration
-- 20260601000000_security_advisor_cleanup.sql. The similarity() function
-- and gin_trgm_ops operator class therefore live in extensions.* and must
-- be referenced with that schema prefix when search_path = ''.

create or replace function public.find_client_matches(
  _tenant_id  uuid,
  _email      text default null,
  _phone_e164 text default null,
  _first_name text default null,
  _last_name  text default null
) returns table(
  id           uuid,
  first_name   text,
  last_name    text,
  email        text,
  phone        text,
  nationality  char(2),
  deleted_at   timestamptz,
  match_kind   text,     -- 'email' | 'phone' | 'name'
  score        smallint
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  -- Only owner/manager roles are allowed. Members (agent, accountant, driver)
  -- cannot access raw client PII via this lookup path.
  if not (select private.has_role_on_tenant(
            _tenant_id,
            array['owner','manager']::public.tenant_role[])) then
    raise exception 'access denied' using errcode = '42501';
  end if;

  return query
  with email_hit as (
    -- Tier 1: exact email match (case-insensitive). Always score 100.
    select c.id, c.first_name, c.last_name, c.email, c.phone,
           c.nationality, c.deleted_at,
           'email'::text   as mk,
           100::smallint   as sc
      from public.clients c
     where c.tenant_id = _tenant_id
       and _email is not null and _email <> ''
       and pg_catalog.lower(c.email) = pg_catalog.lower(_email)
  ),
  phone_hit as (
    -- Tier 2: digit-canonical phone match. Excludes rows already in
    -- email_hit to prevent double-counting.
    select c.id, c.first_name, c.last_name, c.email, c.phone,
           c.nationality, c.deleted_at,
           'phone'::text  as mk,
           80::smallint   as sc
      from public.clients c
     where c.tenant_id = _tenant_id
       and _phone_e164 is not null and _phone_e164 <> ''
       and c.phone_e164 = _phone_e164
       and not exists (select 1 from email_hit e where e.id = c.id)
  ),
  name_hit as (
    -- Tier 3: trigram similarity on full name. Threshold 0.45 keeps
    -- precision high enough for a 8-row suggestion list. Score is scaled
    -- to 0–60 (capped below email and phone tiers). Excludes rows already
    -- matched by email or phone.
    select c.id, c.first_name, c.last_name, c.email, c.phone,
           c.nationality, c.deleted_at,
           'name'::text  as mk,
           (60 * extensions.similarity(
              c.first_name || ' ' || c.last_name,
              coalesce(_first_name, '') || ' ' || coalesce(_last_name, '')
           ))::smallint  as sc
      from public.clients c
     where c.tenant_id = _tenant_id
       and (_first_name is not null or _last_name is not null)
       and extensions.similarity(
             c.first_name || ' ' || c.last_name,
             coalesce(_first_name, '') || ' ' || coalesce(_last_name, '')
           ) > 0.45
       and not exists (select 1 from email_hit e where e.id = c.id)
       and not exists (select 1 from phone_hit p where p.id = c.id)
  )
  select u.id, u.first_name, u.last_name, u.email, u.phone,
         u.nationality, u.deleted_at, u.mk, u.sc
    from (
      select * from email_hit
      union all
      select * from phone_hit
      union all
      select * from name_hit
    ) u
   order by u.sc desc
   limit 8;
end;
$$;

revoke all on function public.find_client_matches(uuid,text,text,text,text) from public, anon;
grant  execute on function public.find_client_matches(uuid,text,text,text,text) to authenticated;
