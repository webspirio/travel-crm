-- Phase 2.x — audit_log.reason column + manager-scoped SELECT policy.
--
-- Two changes here, both in service of the "view & edit booking" UX:
--
-- 1. New `reason text` column on public.audit_log.
--    The booking edit RPCs need to attach a free-text reason for each
--    mutation (e.g. "client called to change pickup stop"). We surface
--    this via a Postgres GUC: the RPC sets `audit.reason` per-transaction
--    with set_config('audit.reason', $1, true) before performing the
--    UPDATE, and the audit trigger reads it back through current_setting
--    with `missing_ok = true` so an unset key returns NULL instead of
--    raising. nullif(..., '') folds explicit empty strings to NULL too,
--    which means callers don't have to RESET the GUC between calls.
--    Existing audit rows get NULL — fine, they predate the feature.
--
-- 2. New SELECT policy `audit_log_select_tenant_scoped`.
--    Managers (and any other active tenant member) need to read the
--    audit trail for their own bookings/passengers/payments to render
--    the "history" panel in the booking detail view. The existing
--    audit_log_select_finance policy gives owner+accountant access to
--    *every* row (including clients, tenant_users); we keep that as-is
--    and OR-add a narrower policy that only covers the three booking-
--    adjacent tables. Postgres OR-combines policies for the same
--    command, so finance reads stay unchanged.
--
-- Trigger function is replaced via CREATE OR REPLACE — the existing
-- triggers attached in 20260508120000_audit_attach.sql keep pointing
-- at the same function name, no re-attach needed.

alter table public.audit_log
  add column reason text;

create or replace function private.audit_trigger() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log
    (tenant_id, actor_user_id, entity_table, entity_id, action, before, after, reason)
  values (
    coalesce(new.tenant_id, old.tenant_id),
    (select auth.uid()),
    tg_table_name,
    coalesce(new.id, old.id),
    pg_catalog.lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
    nullif(pg_catalog.current_setting('audit.reason', true), '')
  );
  return coalesce(new, old);
end;
$$;

create policy audit_log_select_tenant_scoped on public.audit_log
  for select to authenticated
  using (
    entity_table in ('bookings','booking_passengers','payments')
    and (select private.has_role_on_tenant(tenant_id))
  );
