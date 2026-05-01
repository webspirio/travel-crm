-- Phase 2.5 — booking_passengers v2: birth_date, client_id linkage, and
-- clients.phone_e164 generated column.
--
-- Goals:
--   1. booking_passengers gains birth_date for age-category defaults,
--      lap-infant policy enforcement, and contract document generation.
--   2. booking_passengers gains client_id (nullable FK to clients) so a
--      passenger can be promoted to a CRM client record ("Save as client"
--      flow) and future bookings can pre-fill from client history.
--   3. clients gains a stored generated column phone_e164: a digit-canonical
--      E.164 form derived from the existing `phone` text field. The React
--      layer (libphonenumber) writes the formatted display value into `phone`;
--      the DB strips all non-digit/non-plus characters to produce phone_e164
--      for indexed lookups without duplicating storage. NOT UNIQUE — families
--      frequently share a phone number.
--   4. The existing trigger private.booking_passengers_set_and_assert() is
--      extended (via CREATE OR REPLACE) to validate that, when client_id is
--      set, the referenced client belongs to the same tenant as the passenger
--      row. All pre-existing checks are preserved verbatim.

-- ============================================================
-- 1. New columns on booking_passengers
-- ============================================================

alter table public.booking_passengers
  add column birth_date date,
  add column client_id  uuid references public.clients(id) on delete restrict;

-- Partial index — the FK is optional, so we only index non-null values.
create index booking_passengers_client_id_idx
  on public.booking_passengers(client_id)
  where client_id is not null;

-- ============================================================
-- 2. Extend the same-tenant trigger to validate client_id.
--    The existing body (trip_id copy + same-tenant for booking/trip/hotel)
--    is reproduced verbatim; the client_id branch is appended.
-- ============================================================

create or replace function private.booking_passengers_set_and_assert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_trip_id uuid;
  ref_tenant     uuid;
begin
  -- 1. Copy trip_id from the parent booking on INSERT (or verify match
  --    if the caller pre-set it). On UPDATE, trip_id is immutable.
  if tg_op = 'INSERT' then
    select trip_id into parent_trip_id from public.bookings where id = new.booking_id;
    if parent_trip_id is null then
      raise exception 'booking_passengers.booking_id=% references missing booking', new.booking_id;
    end if;
    if new.trip_id is null then
      new.trip_id := parent_trip_id;
    elsif new.trip_id <> parent_trip_id then
      raise exception 'booking_passengers.trip_id=% must match bookings.trip_id=%',
        new.trip_id, parent_trip_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.trip_id is distinct from old.trip_id then
      raise exception 'booking_passengers.trip_id is immutable'
        using errcode = '42501';
    end if;
  end if;

  -- 2. Same-tenant guards across booking, trip, and (optional) hotel.
  select tenant_id into ref_tenant from public.bookings where id = new.booking_id;
  if ref_tenant is null or ref_tenant <> new.tenant_id then
    raise exception 'cross-tenant FK: bookings.id=% (tenant=%) on booking_passengers.tenant_id=%',
      new.booking_id, ref_tenant, new.tenant_id;
  end if;

  select tenant_id into ref_tenant from public.trips where id = new.trip_id;
  if ref_tenant is null or ref_tenant <> new.tenant_id then
    raise exception 'cross-tenant FK: trips.id=% (tenant=%) on booking_passengers.tenant_id=%',
      new.trip_id, ref_tenant, new.tenant_id;
  end if;

  if new.hotel_id is not null then
    select tenant_id into ref_tenant from public.hotels where id = new.hotel_id;
    if ref_tenant is null or ref_tenant <> new.tenant_id then
      raise exception 'cross-tenant FK: hotels.id=% (tenant=%) on booking_passengers.tenant_id=%',
        new.hotel_id, ref_tenant, new.tenant_id;
    end if;
  end if;

  -- 3. New: same-tenant guard for client_id when it is set.
  --    A passenger may be linked to a CRM client record, but that record
  --    must belong to the same tenant — cross-tenant linkage would expose
  --    PII across organisational boundaries.
  if new.client_id is not null then
    select tenant_id into ref_tenant from public.clients where id = new.client_id;
    if ref_tenant is null or ref_tenant <> new.tenant_id then
      raise exception 'cross-tenant FK: clients.id=% on booking_passengers.tenant_id=%',
        new.client_id, new.tenant_id;
    end if;
  end if;

  return new;
end;
$$;

-- The trigger itself (booking_passengers_set_and_assert) was created in
-- 20260508090000_bookings.sql and is already attached — no need to recreate.

-- ============================================================
-- 3. phone_e164 generated column on clients.
--    Strips everything except digits and '+' characters to produce a
--    digit-canonical form for indexed equality lookups. New entries written
--    by libphonenumber arrive as clean E.164 (e.g. '+49301234567') so the
--    result is canonical. Pre-existing free-form data may produce
--    non-canonical results (e.g. multiple '+' signs) but that is an
--    acceptable trade-off — phone_e164 is used only as a soft match signal,
--    not as a validation gate. NULL when phone is NULL or becomes empty
--    after stripping. NOT UNIQUE because families and group organisers
--    routinely share a single phone number.
-- ============================================================

alter table public.clients
  add column phone_e164 text generated always as (
    nullif(regexp_replace(coalesce(phone, ''), '[^0-9+]', '', 'g'), '')
  ) stored;

-- Partial index for fast per-tenant phone lookup (e.g. duplicate detection
-- in find_client_matches). Only live rows — soft-deleted clients are
-- excluded from the matching flow.
create index clients_tenant_phone_e164_idx
  on public.clients(tenant_id, phone_e164)
  where deleted_at is null and phone_e164 is not null;
