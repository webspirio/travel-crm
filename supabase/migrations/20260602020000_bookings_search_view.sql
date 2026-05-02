-- Phase 2.x — bookings_search_view + booking_passengers name trigram index.
--
-- The bookings list page needs a single, denormalised, RLS-aware row source
-- that joins the booking with its primary client, trip metadata, and seller.
-- Building this on the React side via four parallel queries plus a
-- correlated passengers fetch was the alternative; this view collapses it
-- to one round-trip and lets PostgREST own the pagination / filtering.
--
-- Why `security_invoker = true` (Postgres 15+, supported on Supabase):
--   By default a view executes with the privileges of the view's *owner*,
--   which on Supabase is `postgres` — that bypasses every RLS policy on
--   the underlying tables and would leak rows across tenants. With
--   security_invoker the view runs as the calling role, so the existing
--   RLS on `bookings`, `clients`, `trips`, and `managers` applies as if
--   the user had selected from each table directly. The tenant scoping
--   is therefore inherited, not re-implemented here.
--
-- The view is read-only by design — writes still go through the
-- update_*_with_reason RPCs and the create_booking_with_passengers RPC.
--
-- Computed-column expression matching:
--   `client_full_name` and `passenger_full_names` are written byte-for-byte
--   to match the trigram-index expressions on `clients.clients_name_trgm_idx`
--   and `booking_passengers.booking_passengers_name_trgm_idx` — i.e.
--   `(first_name || ' '::text) || last_name`. This lets the planner reuse
--   the GIN trigram index for `ilike '%foo%'` substring search when the
--   user filters the list page. The `passenger_full_names` aggregate is
--   itself a string_agg over the indexed expression, so it cannot use the
--   index directly; the index helps the eventual JOIN-based passenger
--   search query (filter pushdown into booking_passengers, then bubble up
--   the booking ids).

-- ============================================================
-- 1. Trigram GIN index on booking_passengers names.
--    Mirrors clients_name_trgm_idx exactly (same expression, same operator
--    class) so the React layer can use the same `ilike '%query%'` pattern
--    for both surfaces.
-- ============================================================

create extension if not exists pg_trgm;

create index booking_passengers_name_trgm_idx
  on public.booking_passengers
  using gin (((first_name || ' '::text) || last_name) gin_trgm_ops);

-- ============================================================
-- 2. bookings_search_view — list-page driver.
--    Filters out soft-deleted bookings at the view level so callers don't
--    have to remember the `deleted_at is null` predicate. Owners who need
--    to see soft-deleted rows query `public.bookings` directly (where the
--    deleted_at-aware RLS pair lives).
-- ============================================================

create view public.bookings_search_view
with (security_invoker = true) as
select
  -- Identity / scoping.
  b.id,
  b.tenant_id,
  -- Booking pass-through (numbers, status, money, FKs, timestamps).
  b.booking_number,
  b.contract_number,
  b.operator_ref,
  b.invoice_number,
  b.status,
  b.total_price_eur,
  b.paid_amount_eur,
  b.commission_eur,
  b.due_date,
  b.notes,
  b.client_id,
  b.trip_id,
  b.sold_by_manager_id,
  b.created_at,
  b.updated_at,
  -- Client join (LEFT JOIN: a booking's client_id is NOT NULL today, but
  -- LEFT keeps the view resilient if that ever loosens, and lets it survive
  -- a client row being filtered by RLS edge cases without dropping the row).
  c.email                         as client_email,
  c.phone                         as client_phone,
  c.id                            as client_id_resolved,
  -- Trip join. Note: the column is `departure_at` (timestamptz), not
  -- `departure_date` — the latter does not exist on public.trips.
  t.name                          as trip_name,
  t.destination                   as trip_destination,
  t.departure_at                  as trip_departure_at,
  -- Seller display name.
  m.display_name                  as sold_by_manager_name,
  -- Computed: full client name. Expression matches clients_name_trgm_idx
  -- byte-for-byte so `ilike '%foo%'` on this column can use the GIN index.
  -- NULL when the LEFT JOIN misses; consumers handle that case in the UI.
  (c.first_name || ' '::text) || c.last_name              as client_full_name,
  -- Computed: comma-separated passenger names, deterministic order by id.
  -- Same `||' '::text||` shape as booking_passengers_name_trgm_idx — the
  -- index applies to direct passenger filtering, not to this aggregate.
  (
    select string_agg((bp.first_name || ' '::text) || bp.last_name,
                      ', ' order by bp.id)
    from public.booking_passengers bp
    where bp.booking_id = b.id
  )                                                       as passenger_full_names,
  -- Computed: passenger headcount.
  (
    select count(*)::int
    from public.booking_passengers bp
    where bp.booking_id = b.id
  )                                                       as passengers_count,
  -- Computed: outstanding balance. Negative is allowed (overpayment) and
  -- intentionally not coalesced — both source columns are NOT NULL.
  b.total_price_eur - b.paid_amount_eur                   as outstanding_eur
from public.bookings b
left join public.clients  c on c.id = b.client_id
left join public.trips    t on t.id = b.trip_id
left join public.managers m on m.id = b.sold_by_manager_id
where b.deleted_at is null;

comment on view public.bookings_search_view is
  'List-page driver. RLS applies via security_invoker. Use ILIKE on client_full_name / passenger_full_names — both expressions are trigram-indexed.';

-- PostgREST exposes views to the `authenticated` role automatically when
-- the role can SELECT them; the explicit grant is belt-and-braces and makes
-- the surface readable from a `\dp` audit without chasing role inheritance.
grant select on public.bookings_search_view to authenticated;
