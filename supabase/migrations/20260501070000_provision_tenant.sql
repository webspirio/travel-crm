-- Phase 1.8 — atomic tenant + owner provisioning.
--
-- The provisioning script previously did two separate Supabase REST calls
-- (insert tenant, then insert tenant_users), with no transaction guarantee
-- between them. Wrapping both inserts in a server-side function makes them
-- atomic: either both rows land or neither does. The Supabase JS client
-- invokes this via supabase.rpc('provision_tenant_and_owner', ...).
--
-- The function is exposed in `public` (not `private`) because PostgREST
-- only exposes functions in API-facing schemas. It's restricted to
-- `service_role` only — `authenticated` and `anon` cannot call it. Etap 2
-- self-serve signup will re-evaluate this access model.

create or replace function public.provision_tenant_and_owner(
  _slug text,
  _name text,
  _user_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid;
  owner_email text;
begin
  insert into public.tenants (slug, name)
  values (_slug, _name)
  returning id into tid;

  insert into public.tenant_users (tenant_id, user_id, role, is_active)
  values (tid, _user_id, 'owner', true);

  -- Pull email from auth.users so the owner's managers row carries the
  -- same identity. display_name defaults to the local-part of the email
  -- (the manager profile UI is the place to edit it).
  select email into owner_email from auth.users where id = _user_id;
  if owner_email is null then
    raise exception 'provision_tenant_and_owner: auth.users.id=% not found', _user_id
      using errcode = 'P0002';
  end if;

  -- One managers row per (tenant, user) is the Etap 1 invariant. The
  -- owner needs this row to satisfy bookings.sold_by_manager_id,
  -- trips.owner_manager_id, and trip_agents.manager_id FKs.
  insert into public.managers (tenant_id, user_id, display_name, email)
  values (tid, _user_id, pg_catalog.split_part(owner_email, '@', 1), owner_email);

  return tid;
end;
$$;

revoke all on function public.provision_tenant_and_owner(text, text, uuid) from public;
revoke all on function public.provision_tenant_and_owner(text, text, uuid) from anon;
revoke all on function public.provision_tenant_and_owner(text, text, uuid) from authenticated;
grant execute on function public.provision_tenant_and_owner(text, text, uuid) to service_role;
