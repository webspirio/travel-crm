-- Phase 2.3 — routes + route_stops (templates).
--
-- Routes are reusable pickup-sequence templates (e.g. Prague → Nuremberg →
-- Munich → Augsburg). Per-trip stop times live in trip_stops, materialised
-- from route_stops on trips INSERT (see 20260508045000_trip_stops.sql).
-- Per-trip edits to pickup time mutate trip_stops, never the route_stops
-- template — so editing one trip's stop time doesn't bleed into other
-- trips that share the route.
--
-- gps is text (Plus Code or "lat,lng") rather than the geometry/point type
-- to avoid pulling in PostGIS for what is currently display-only data.
-- Migration to point + GiST index is purely additive when route mapping
-- becomes a feature.

create table public.routes (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  name            text not null,
  description     text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index routes_tenant_id_idx on public.routes(tenant_id);

create trigger routes_touch_updated_at
  before update on public.routes
  for each row execute function private.touch_updated_at();

create trigger routes_assert_tenant_id_immutable
  before update on public.routes
  for each row execute function private.assert_tenant_id_immutable();

alter table public.routes enable row level security;

-- route_stops is ordered, with time_offset_min from departure (positive
-- on outbound, can be negative for hotel-to-airport repositioning).
create table public.route_stops (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  route_id          uuid not null references public.routes(id) on delete cascade,
  ord               smallint not null,
  city              text not null,
  address           text,
  gps               text,
  time_offset_min   integer not null default 0,
  created_at        timestamptz not null default now(),
  unique (route_id, ord)
);

create index route_stops_tenant_id_idx on public.route_stops(tenant_id);
create index route_stops_route_id_idx  on public.route_stops(route_id);

create trigger route_stops_assert_tenant_id_immutable
  before update on public.route_stops
  for each row execute function private.assert_tenant_id_immutable();

-- Same-tenant FK guard: route_stops.tenant_id must match
-- routes.tenant_id. Prevents a multi-tenant member from linking a stop
-- to a route in a different tenant. Inline static lookup, no shared
-- helper (per source plan §2.4a).
create or replace function private.route_stops_assert_same_tenant() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref_tenant uuid;
begin
  select tenant_id into ref_tenant from public.routes where id = new.route_id;
  if ref_tenant is null or ref_tenant <> new.tenant_id then
    raise exception 'cross-tenant FK: routes.id=% (tenant=%) on route_stops.tenant_id=%',
      new.route_id, ref_tenant, new.tenant_id;
  end if;
  return new;
end;
$$;

create trigger route_stops_assert_same_tenant
  before insert or update on public.route_stops
  for each row execute function private.route_stops_assert_same_tenant();

alter table public.route_stops enable row level security;
