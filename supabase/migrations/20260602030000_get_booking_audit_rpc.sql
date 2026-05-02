-- Phase 3.5 — Booking audit history RPC.
--
-- T1 added the manager-scoped audit_log SELECT policy (entity_table whitelist).
-- T11 builds the History tab on top of that policy. Rather than building a
-- complex PostgREST .or() URL with passenger/payment id lists, this RPC
-- unions the three sources server-side and returns one feed sorted newest
-- first.
--
-- security invoker (default) — the RPC runs with the caller's RLS context,
-- so the existing audit_log_select_tenant_scoped policy filters cross-tenant
-- and non-whitelisted entity_tables automatically. No need to redo the auth
-- check inside.
--
-- Pagination: cursor-based. Caller passes the oldest `created_at` they've
-- seen so far (or NULL on first load) and a limit. Returns rows strictly
-- before the cursor. NULL cursor → first page.
--
-- Actor display name: the only safe lookup under security invoker is
-- public.managers (joined on user_id + tenant_id). auth.users is not
-- readable by the `authenticated` role, so we cannot fall back to email
-- here without flipping to security definer — which would require redoing
-- the audit_log RLS check manually inside the function. Trade-off: actors
-- without a managers row (rare; e.g. an owner who was never provisioned a
-- managers profile, or a deleted manager) surface as '—'. Acceptable for
-- this read-only feed.

create or replace function public.get_booking_audit(
  p_booking_id uuid,
  p_limit int default 20,
  p_before timestamptz default null
)
returns table (
  id            bigint,
  tenant_id     uuid,
  actor_user_id uuid,
  actor_name    text,
  entity_table  text,
  entity_id     uuid,
  action        text,
  before        jsonb,
  after         jsonb,
  reason        text,
  created_at    timestamptz
)
language sql
security invoker          -- enforce RLS on audit_log + the joined tables
stable
set search_path = ''
as $$
  with passenger_ids as (
    select bp.id from public.booking_passengers bp where bp.booking_id = p_booking_id
  ),
  payment_ids as (
    select p.id from public.payments p where p.booking_id = p_booking_id
  ),
  rows as (
    select a.*
    from public.audit_log a
    where (
      (a.entity_table = 'bookings'           and a.entity_id = p_booking_id) or
      (a.entity_table = 'booking_passengers' and a.entity_id in (select id from passenger_ids)) or
      (a.entity_table = 'payments'           and a.entity_id in (select id from payment_ids))
    )
    and (p_before is null or a.created_at < p_before)
  )
  select
    r.id,
    r.tenant_id,
    r.actor_user_id,
    coalesce(m.display_name, '—') as actor_name,
    r.entity_table,
    r.entity_id,
    r.action,
    r.before,
    r.after,
    r.reason,
    r.created_at
  from rows r
  left join public.managers m
    on m.user_id = r.actor_user_id
   and m.tenant_id = r.tenant_id
  order by r.created_at desc
  limit p_limit;
$$;

revoke all on function public.get_booking_audit(uuid, int, timestamptz) from public, anon;
grant execute on function public.get_booking_audit(uuid, int, timestamptz) to authenticated;

comment on function public.get_booking_audit(uuid, int, timestamptz) is
  'Returns audit_log rows for a booking, its passengers, and its payments — joined with the actor''s display_name from public.managers. Pagination via timestamp cursor (p_before, exclusive). RLS on audit_log enforces tenant scope + the bookings/booking_passengers/payments entity_table whitelist.';
