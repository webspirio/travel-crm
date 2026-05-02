-- Phase 3.5b — Fix cursor pagination ties in get_booking_audit.
--
-- The original RPC (20260602030000) used `created_at desc` with a strict-less-than
-- cursor. When two audit_log rows share created_at (common: multi-row INSERT in
-- one transaction → triggers fire under the same now() snapshot), and the tie
-- straddles a page boundary, the second row is silently dropped.
--
-- Fix: pair the cursor with audit_log.id (bigint identity, monotonic, unique).
-- Order by (created_at desc, id desc). Cursor predicate:
--   (a.created_at, a.id) < (p_before_ts, p_before_id)   -- row-tuple comparison
-- which Postgres evaluates lexicographically.
--
-- Backwards-compat: if only the timestamp cursor is provided, id defaults to
-- bigint maxvalue (so the first page after a `<= ts` boundary is correct).
-- For the React hook this branch always passes both, so the fallback is just
-- for ad-hoc psql usage.

create or replace function public.get_booking_audit(
  p_booking_id   uuid,
  p_limit        int           default 20,
  p_before_ts    timestamptz   default null,
  p_before_id    bigint        default null
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
security invoker
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
    and (
      p_before_ts is null
      or (a.created_at, a.id) < (p_before_ts, coalesce(p_before_id, 9223372036854775807::bigint))
    )
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
  order by r.created_at desc, r.id desc
  limit p_limit;
$$;

revoke all on function public.get_booking_audit(uuid, int, timestamptz, bigint) from public, anon;
grant execute on function public.get_booking_audit(uuid, int, timestamptz, bigint) to authenticated;

comment on function public.get_booking_audit(uuid, int, timestamptz, bigint) is
  'Returns audit_log rows for a booking, its passengers, and its payments — joined with the actor''s display_name from public.managers. Pagination via lexicographic (created_at, id) tuple cursor (exclusive). Tie-safe: when multiple rows share created_at (e.g. multi-row INSERT in one transaction), the bigint id breaks the tie so no row is dropped at a page boundary. RLS on audit_log enforces tenant scope + the bookings/booking_passengers/payments entity_table whitelist.';

-- Drop the old 3-arg variant to avoid signature ambiguity.
-- Safe: the only caller (useBookingHistory) is in this branch and is being
-- updated to the 4-arg signature in the same commit.
drop function if exists public.get_booking_audit(uuid, int, timestamptz);
