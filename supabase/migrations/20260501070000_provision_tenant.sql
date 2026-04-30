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
begin
  insert into public.tenants (slug, name)
  values (_slug, _name)
  returning id into tid;

  insert into public.tenant_users (tenant_id, user_id, role, is_active)
  values (tid, _user_id, 'owner', true);

  return tid;
end;
$$;

revoke all on function public.provision_tenant_and_owner(text, text, uuid) from public;
revoke all on function public.provision_tenant_and_owner(text, text, uuid) from anon;
revoke all on function public.provision_tenant_and_owner(text, text, uuid) from authenticated;
grant execute on function public.provision_tenant_and_owner(text, text, uuid) to service_role;
