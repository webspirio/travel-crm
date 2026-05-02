-- Phase 2.5 — restore_client RPC.
--
-- Clears deleted_at on a soft-deleted clients row. The function is
-- SECURITY INVOKER: the caller's own role is used for the UPDATE, so the
-- RLS policy clients_update_managers (which allows owner or manager role on
-- the client's tenant — see 20260508900000_domain_rls.sql) provides the
-- access gate. No additional check is needed inside the function — RLS
-- does the work.
--
-- Both owners and managers may restore a client. Callers with neither role
-- (e.g. anon, accountant) receive 0 rows updated because RLS silently
-- filters the row — no error leaks information about its existence. The UI
-- may choose to hide the Restore button from managers as a UX decision, but
-- the database does not enforce an owner-only constraint here.

create or replace function public.restore_client(_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.clients
     set deleted_at = null
   where id = _id;
$$;

revoke all on function public.restore_client(uuid) from public, anon;
grant  execute on function public.restore_client(uuid) to authenticated;
