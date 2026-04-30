-- Phase 2.3 — trip_seats with reservation TTL.
--
-- One row per (trip_id, seat_number). Materialised on trip INSERT via
-- the trip_seats_materialise trigger (declared + attached at the bottom
-- of this migration). A composite FK (trip_id, seat_number) is the
-- target of booking_passengers — guarantees no passenger sits on a
-- seat that doesn't exist on their trip.
--
-- Concurrency model: optimistic UPDATE with lazy expiry (see source
-- plan §"Concurrency model"). No EXCLUDE constraint — at AnyTour's
-- scale (50–80 seats × ≤4 simultaneous managers per trip) the simpler
-- conditional UPDATE pattern wins. btree_gist is enabled in Phase 1
-- but unused at this layer.
--
-- reserved_at is the timestamp the soft-hold was acquired.
-- reserved_until is the TTL expiry. Lazy expiry: any UPDATE that
-- claims a 'free' seat OR a 'reserved' seat whose reserved_until <
-- now() succeeds. A pg_cron sweeper to hard-reset expired holds is
-- deferred to Etap 2.

create table public.trip_seats (
  id                  uuid not null default gen_random_uuid() unique,
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  trip_id             uuid not null references public.trips(id) on delete cascade,
  seat_number         smallint not null,
  status              public.seat_status not null default 'free',
  reserved_at         timestamptz,
  reserved_until      timestamptz,
  held_by_manager_id  uuid references public.managers(id) on delete set null,
  booking_id          uuid,                                    -- FK added in bookings migration
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  primary key (trip_id, seat_number)
);

create index trip_seats_tenant_id_idx  on public.trip_seats(tenant_id);
create index trip_seats_trip_id_idx    on public.trip_seats(trip_id);
create index trip_seats_booking_id_idx on public.trip_seats(booking_id) where booking_id is not null;

create trigger trip_seats_touch_updated_at
  before update on public.trip_seats
  for each row execute function private.touch_updated_at();

create trigger trip_seats_aa_assert_tenant_id_immutable
  before update on public.trip_seats
  for each row execute function private.assert_tenant_id_immutable();

-- Same-tenant guard for trip_seats. booking_id is checked once that FK
-- exists (added in bookings migration). The held_by_manager_id is
-- checked here.
create or replace function private.trip_seats_assert_same_tenant() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref_tenant uuid;
begin
  select tenant_id into ref_tenant from public.trips where id = new.trip_id;
  if ref_tenant is null or ref_tenant <> new.tenant_id then
    raise exception 'cross-tenant FK: trips.id=% (tenant=%) on trip_seats.tenant_id=%',
      new.trip_id, ref_tenant, new.tenant_id;
  end if;

  if new.held_by_manager_id is not null then
    select tenant_id into ref_tenant from public.managers where id = new.held_by_manager_id;
    if ref_tenant is null or ref_tenant <> new.tenant_id then
      raise exception 'cross-tenant FK: managers.id=% (tenant=%) on trip_seats.tenant_id=%',
        new.held_by_manager_id, ref_tenant, new.tenant_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger trip_seats_assert_same_tenant
  before insert or update on public.trip_seats
  for each row execute function private.trip_seats_assert_same_tenant();

alter table public.trip_seats enable row level security;

-- Materialise function: on trip INSERT, generate one trip_seats row per
-- seat 1..capacity. Capacity changes after creation are not supported in
-- Etap 1 (the trigger fires on INSERT only); shrinking would risk
-- orphaning sold seats and growing has no concrete user need yet.
create or replace function private.trip_seats_materialise() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.trip_seats (tenant_id, trip_id, seat_number, status)
    select new.tenant_id, new.id, gs, 'free'
    from generate_series(1, new.capacity) as gs;
  return new;
end;
$$;

create trigger trips_materialise_seats
  after insert on public.trips
  for each row execute function private.trip_seats_materialise();
