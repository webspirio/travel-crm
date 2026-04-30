-- Phase 2.3 — trips + trip_agents.
--
-- trips carries pricing authoritatively (Decision #13: per-trip is the
-- source of truth; tenant-wide pricing rules are deferred to Etap 2 and
-- become a purely additive migration).
--
-- Commission resolution at booking time:
--   coalesce(trip_agents.override_commission_pct,
--            trips.commission_pct_override,
--            managers.commission_pct).
--
-- owner_manager_id is the trip lead (responsible for execution).
-- trip_agents is the M:N table for agents who can also sell on the trip.
-- bookings.sold_by_manager_id is the seller (may differ from owner).
-- This split lets one manager run a trip while other staff sell into it,
-- without losing RLS access for either.
--
-- The trip_stops materialise + realign triggers are attached at the end
-- of this migration. The composite FK from trip_stops.trip_id to
-- public.trips(id) is also added here (it had to be deferred from the
-- trip_stops migration because public.trips didn't exist yet).

create table public.trips (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  name                        text not null,
  destination                 text not null,
  origin                      text not null,
  route_id                    uuid references public.routes(id) on delete set null,
  owner_manager_id            uuid not null references public.managers(id) on delete restrict,
  bus_type                    public.bus_type not null,
  capacity                    smallint not null check (capacity > 0),
  departure_at                timestamptz not null,
  return_at                   timestamptz not null,
  status                      public.trip_status not null default 'planned',
  -- Per-trip pricing columns (Decision #13). Adult = base.
  base_price_eur              numeric(10,2) not null check (base_price_eur >= 0),
  child_price_eur             numeric(10,2) not null check (child_price_eur >= 0),
  infant_price_eur            numeric(10,2) not null default 0 check (infant_price_eur >= 0),
  front_rows_count            smallint not null default 0 check (front_rows_count >= 0),
  front_rows_surcharge_eur    numeric(10,2) not null default 0 check (front_rows_surcharge_eur >= 0),
  -- Tenant-wide commission override for this trip (nullable). Per-agent
  -- override on trip_agents wins over this; this wins over manager default.
  commission_pct_override     numeric(5,2) check (commission_pct_override is null or commission_pct_override >= 0),
  notes                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  check (return_at >= departure_at)
);

create index trips_tenant_id_idx        on public.trips(tenant_id);
create index trips_owner_manager_id_idx on public.trips(owner_manager_id);
create index trips_route_id_idx         on public.trips(route_id);
create index trips_departure_at_idx     on public.trips(tenant_id, departure_at);
create index trips_status_idx           on public.trips(tenant_id, status);

create trigger trips_touch_updated_at
  before update on public.trips
  for each row execute function private.touch_updated_at();

create trigger trips_aa_assert_tenant_id_immutable
  before update on public.trips
  for each row execute function private.assert_tenant_id_immutable();

-- Same-tenant guard for trips' FKs (route_id, owner_manager_id).
create or replace function private.trips_assert_same_tenant() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref_tenant uuid;
begin
  if new.route_id is not null then
    select tenant_id into ref_tenant from public.routes where id = new.route_id;
    if ref_tenant is null or ref_tenant <> new.tenant_id then
      raise exception 'cross-tenant FK: routes.id=% (tenant=%) on trips.tenant_id=%',
        new.route_id, ref_tenant, new.tenant_id;
    end if;
  end if;

  select tenant_id into ref_tenant from public.managers where id = new.owner_manager_id;
  if ref_tenant is null or ref_tenant <> new.tenant_id then
    raise exception 'cross-tenant FK: managers.id=% (tenant=%) on trips.tenant_id=%',
      new.owner_manager_id, ref_tenant, new.tenant_id;
  end if;

  return new;
end;
$$;

create trigger trips_assert_same_tenant
  before insert or update on public.trips
  for each row execute function private.trips_assert_same_tenant();

alter table public.trips enable row level security;

-- Wire the trip_stops triggers (materialise / realign) declared in the
-- previous migration. AFTER INSERT to materialise; AFTER UPDATE OF the
-- two columns that affect trip_stops (departure_at re-shifts, route_id
-- replaces wholesale).
create trigger trips_materialise_stops
  after insert on public.trips
  for each row execute function private.trip_stops_materialise();

create trigger trips_realign_stops
  after update of departure_at, route_id on public.trips
  for each row execute function private.trip_stops_realign();

-- Now that public.trips exists, finish the trip_stops table: add the
-- FK + the same-tenant trigger declared in 20260508045000_trip_stops.sql.
alter table public.trip_stops
  add constraint trip_stops_trip_id_fkey
  foreign key (trip_id) references public.trips(id) on delete cascade;

create trigger trip_stops_assert_same_tenant
  before insert or update on public.trip_stops
  for each row execute function private.trip_stops_assert_same_tenant();

-- M:N table for agents assigned to a trip. override_commission_pct is
-- per-(trip, agent); takes precedence over trips.commission_pct_override
-- and managers.commission_pct.
create table public.trip_agents (
  id                          uuid not null default gen_random_uuid() unique,
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  trip_id                     uuid not null references public.trips(id) on delete cascade,
  manager_id                  uuid not null references public.managers(id) on delete cascade,
  override_commission_pct     numeric(5,2) check (override_commission_pct is null or override_commission_pct >= 0),
  created_at                  timestamptz not null default now(),
  primary key (trip_id, manager_id)
);

create index trip_agents_tenant_id_idx  on public.trip_agents(tenant_id);
create index trip_agents_manager_id_idx on public.trip_agents(manager_id);

create trigger trip_agents_aa_assert_tenant_id_immutable
  before update on public.trip_agents
  for each row execute function private.assert_tenant_id_immutable();

create or replace function private.trip_agents_assert_same_tenant() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref_tenant uuid;
begin
  select tenant_id into ref_tenant from public.trips where id = new.trip_id;
  if ref_tenant is null or ref_tenant <> new.tenant_id then
    raise exception 'cross-tenant FK: trips.id=% (tenant=%) on trip_agents.tenant_id=%',
      new.trip_id, ref_tenant, new.tenant_id;
  end if;

  select tenant_id into ref_tenant from public.managers where id = new.manager_id;
  if ref_tenant is null or ref_tenant <> new.tenant_id then
    raise exception 'cross-tenant FK: managers.id=% (tenant=%) on trip_agents.tenant_id=%',
      new.manager_id, ref_tenant, new.tenant_id;
  end if;

  return new;
end;
$$;

create trigger trip_agents_assert_same_tenant
  before insert or update on public.trip_agents
  for each row execute function private.trip_agents_assert_same_tenant();

alter table public.trip_agents enable row level security;
