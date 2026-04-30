-- Phase 2.3 — bookings + booking_passengers.
--
-- Bookings carry FOUR ID fields (per source plan §2.3 + Round 2):
--   booking_number   — primary user-facing ID, unique per tenant, auto-
--                      generated at INSERT (e.g. '26001').
--   contract_number  — formal legal contract number, unique per tenant
--                      when set, auto-generated when status flips to
--                      'confirmed'. Often equal to booking_number.
--   operator_ref     — partner/operator code, free-form, indexed not unique.
--   invoice_number   — accounting invoice reference, free-form, indexed.
--
-- The booking_number / contract_number generators (private.next_booking_number)
-- live in 20260508115000_booking_counters.sql. The BEFORE INSERT trigger
-- here forward-references that function — plpgsql resolves on execution
-- and the migration ordering ensures the function exists before any
-- INSERT lands.
--
-- booking_passengers carries a denormalised trip_id (copied from bookings
-- via a BEFORE INSERT trigger) so the composite FK (trip_id, seat_number)
-- → trip_seats can guarantee no passenger sits on a seat that doesn't
-- exist on their trip. seat_number is nullable to support lap-infants;
-- a CHECK constraint requires it for adult/child.
--
-- Soft-delete via deleted_at on bookings. The RLS pair (members see live,
-- owners additionally see deleted) is in 20260508900000_domain_rls.sql.
-- The state-machine trigger (bookings_assert_status_transition) is also
-- in domain_rls.

create table public.bookings (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  booking_number      text not null,
  contract_number     text,
  operator_ref        text,
  invoice_number      text,
  client_id           uuid not null references public.clients(id) on delete restrict,
  trip_id             uuid not null references public.trips(id) on delete restrict,
  sold_by_manager_id  uuid not null references public.managers(id) on delete restrict,
  status              public.booking_status not null default 'draft',
  total_price_eur     numeric(10,2) not null default 0 check (total_price_eur >= 0),
  paid_amount_eur     numeric(10,2) not null default 0 check (paid_amount_eur >= 0),
  due_date            date,
  commission_eur      numeric(10,2) not null default 0,
  notes               text,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index bookings_tenant_id_idx           on public.bookings(tenant_id);
create index bookings_sold_by_manager_id_idx  on public.bookings(sold_by_manager_id);
create index bookings_client_id_idx           on public.bookings(client_id);
create index bookings_trip_id_idx             on public.bookings(trip_id);
create index bookings_status_idx              on public.bookings(tenant_id, status);
create unique index bookings_tenant_booking_number_uniq
  on public.bookings(tenant_id, booking_number);
create unique index bookings_tenant_contract_number_uniq
  on public.bookings(tenant_id, contract_number)
  where contract_number is not null;
create index bookings_tenant_operator_ref_idx
  on public.bookings(tenant_id, operator_ref)
  where operator_ref is not null;
create index bookings_tenant_invoice_number_idx
  on public.bookings(tenant_id, invoice_number)
  where invoice_number is not null;

create trigger bookings_touch_updated_at
  before update on public.bookings
  for each row execute function private.touch_updated_at();

create trigger bookings_aa_assert_tenant_id_immutable
  before update on public.bookings
  for each row execute function private.assert_tenant_id_immutable();

-- Same-tenant guard: client / trip / manager must all be in the same
-- tenant as the booking. Multi-FK static lookups inline (no shared helper).
create or replace function private.bookings_assert_same_tenant() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref_tenant uuid;
begin
  select tenant_id into ref_tenant from public.clients where id = new.client_id;
  if ref_tenant is null or ref_tenant <> new.tenant_id then
    raise exception 'cross-tenant FK: clients.id=% (tenant=%) on bookings.tenant_id=%',
      new.client_id, ref_tenant, new.tenant_id;
  end if;

  select tenant_id into ref_tenant from public.trips where id = new.trip_id;
  if ref_tenant is null or ref_tenant <> new.tenant_id then
    raise exception 'cross-tenant FK: trips.id=% (tenant=%) on bookings.tenant_id=%',
      new.trip_id, ref_tenant, new.tenant_id;
  end if;

  select tenant_id into ref_tenant from public.managers where id = new.sold_by_manager_id;
  if ref_tenant is null or ref_tenant <> new.tenant_id then
    raise exception 'cross-tenant FK: managers.id=% (tenant=%) on bookings.tenant_id=%',
      new.sold_by_manager_id, ref_tenant, new.tenant_id;
  end if;

  return new;
end;
$$;

create trigger bookings_assert_same_tenant
  before insert or update on public.bookings
  for each row execute function private.bookings_assert_same_tenant();

-- BEFORE INSERT: auto-generate booking_number from the per-tenant counter.
-- Forward-references private.next_booking_number which is created in
-- 20260508115000_booking_counters.sql. Migration ordering guarantees the
-- function exists before any INSERT runs against this table.
create or replace function private.bookings_set_booking_number() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.booking_number is null or new.booking_number = '' then
    new.booking_number := private.next_booking_number(new.tenant_id);
  end if;
  return new;
end;
$$;

create trigger bookings_set_booking_number
  before insert on public.bookings
  for each row execute function private.bookings_set_booking_number();

-- BEFORE UPDATE OF status: when status flips into 'confirmed' for the
-- first time AND contract_number is still null, allocate it. Same
-- generator (gapless within tenant-year). Re-confirmations after a
-- partial-paid round-trip don't re-allocate.
create or replace function private.bookings_set_contract_number() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'confirmed' and old.status <> 'confirmed' and new.contract_number is null then
    new.contract_number := private.next_booking_number(new.tenant_id);
  end if;
  return new;
end;
$$;

create trigger bookings_set_contract_number
  before update of status on public.bookings
  for each row execute function private.bookings_set_contract_number();

alter table public.bookings enable row level security;

-- Now that public.bookings exists, finish trip_seats: add the FK to
-- bookings (trip_seats.booking_id was forward-declared without FK).
alter table public.trip_seats
  add constraint trip_seats_booking_id_fkey
  foreign key (booking_id) references public.bookings(id) on delete set null;

-- Per-passenger detail. Composite FK to trip_seats means seat existence
-- is guaranteed at INSERT time. trip_id is denormalised from
-- bookings.trip_id via the BEFORE INSERT trigger below.
create table public.booking_passengers (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  booking_id          uuid not null references public.bookings(id) on delete cascade,
  -- Denormalised from bookings.trip_id by the BEFORE INSERT trigger so
  -- the composite FK (trip_id, seat_number) -> trip_seats works without
  -- an extra join. Immutability is enforced by the same-tenant trigger
  -- (which fails fast if booking_passengers.trip_id ≠ bookings.trip_id).
  trip_id             uuid not null,
  kind                public.passenger_kind not null,
  first_name          text not null,
  last_name           text not null,
  -- Nullable to support lap-infants. The CHECK below requires it for
  -- adult/child. The composite FK (trip_id, seat_number) is satisfied
  -- by NULL via Postgres' MATCH SIMPLE default.
  seat_number         smallint,
  hotel_id            uuid references public.hotels(id) on delete restrict,
  room_type           public.room_type,
  price_total_eur     numeric(10,2) not null default 0 check (price_total_eur >= 0),
  price_breakdown     jsonb not null default '{}'::jsonb,
  special_notes       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (kind = 'infant' or seat_number is not null),
  -- Composite FK: passenger's seat must exist on their trip.
  foreign key (trip_id, seat_number) references public.trip_seats(trip_id, seat_number) on delete restrict
);

create index booking_passengers_tenant_id_idx     on public.booking_passengers(tenant_id);
create index booking_passengers_booking_id_idx    on public.booking_passengers(booking_id);
create index booking_passengers_trip_id_idx       on public.booking_passengers(trip_id);
create index booking_passengers_trip_seat_idx     on public.booking_passengers(trip_id, seat_number);
create index booking_passengers_hotel_id_idx      on public.booking_passengers(hotel_id) where hotel_id is not null;

create trigger booking_passengers_touch_updated_at
  before update on public.booking_passengers
  for each row execute function private.touch_updated_at();

create trigger booking_passengers_aa_assert_tenant_id_immutable
  before update on public.booking_passengers
  for each row execute function private.assert_tenant_id_immutable();

-- BEFORE INSERT: copy trip_id from the parent bookings row, then check
-- every FK lives in the same tenant. Combined into a single trigger
-- function so the trip_id assignment necessarily runs before the
-- same-tenant validation — Postgres fires triggers in name order, and
-- a separate assert trigger named alphabetically before set_trip_id
-- would see a null trip_id and raise.
--
-- On UPDATE, trip_id is immutable in practice (booking_passengers don't
-- migrate between trips), so the same-tenant function only re-validates
-- the static FK shape.
create or replace function private.booking_passengers_set_and_assert() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_trip_id uuid;
  ref_tenant uuid;
begin
  -- 1. Copy trip_id from the parent booking on INSERT (or verify match
  --    if the caller pre-set it).
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

  return new;
end;
$$;

create trigger booking_passengers_set_and_assert
  before insert or update on public.booking_passengers
  for each row execute function private.booking_passengers_set_and_assert();

alter table public.booking_passengers enable row level security;
