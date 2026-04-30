-- Phase 2.3 — trip_stops materialised pickups.
--
-- Per-trip pickup times derived from the route template (route_stops) at
-- trip-creation time. Once materialised, edits to trip_stops.scheduled_at
-- are local to the trip and do not touch the template — different trips
-- on the same route can have different pickup times without template
-- proliferation.
--
-- Materialise function declared here, attached to public.trips in the
-- next migration (20260508050000_trips.sql) which is where the trips
-- table is created. The function is plpgsql / stable / search_path='' —
-- references resolve at execution time, so forward-declaring against
-- public.trips is fine as long as the trigger is not ATTACHED until
-- the table exists.

create table public.trip_stops (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  trip_id         uuid not null,                                   -- FK added in trips migration after public.trips exists
  ord             smallint not null,
  city            text not null,
  address         text,
  gps             text,
  scheduled_at    timestamptz not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (trip_id, ord)
);

create index trip_stops_tenant_id_idx on public.trip_stops(tenant_id);
create index trip_stops_trip_id_idx   on public.trip_stops(trip_id);

create trigger trip_stops_touch_updated_at
  before update on public.trip_stops
  for each row execute function private.touch_updated_at();

create trigger trip_stops_assert_tenant_id_immutable
  before update on public.trip_stops
  for each row execute function private.assert_tenant_id_immutable();

-- Same-tenant guard: trip_stops.tenant_id must match trips.tenant_id.
-- Inline static lookup; trip_stops_materialise() also creates rows
-- with tenant_id derived from the parent trip, so the guard is mostly
-- defense-in-depth against direct INSERTs from operations scripts.
create or replace function private.trip_stops_assert_same_tenant() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref_tenant uuid;
begin
  select tenant_id into ref_tenant from public.trips where id = new.trip_id;
  if ref_tenant is null or ref_tenant <> new.tenant_id then
    raise exception 'cross-tenant FK: trips.id=% (tenant=%) on trip_stops.tenant_id=%',
      new.trip_id, ref_tenant, new.tenant_id;
  end if;
  return new;
end;
$$;

-- The same-tenant trigger and the FK constraint to public.trips are both
-- attached in 20260508050000_trips.sql, after public.trips is created.

alter table public.trip_stops enable row level security;

-- Materialise function: copy each route_stop into trip_stops, computing
-- scheduled_at = trip.departure_at + (time_offset_min minutes). NULL
-- route_id on the trip means the template is not yet linked — function
-- exits without inserting (the user can add stops manually later, or
-- attach a route via UPDATE which re-fires the trigger).
create or replace function private.trip_stops_materialise() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.route_id is null then
    return new;
  end if;

  insert into public.trip_stops (tenant_id, trip_id, ord, city, address, gps, scheduled_at)
    select
      new.tenant_id,
      new.id,
      rs.ord,
      rs.city,
      rs.address,
      rs.gps,
      new.departure_at + make_interval(mins => rs.time_offset_min)
    from public.route_stops rs
    where rs.route_id = new.route_id
    order by rs.ord;

  return new;
end;
$$;

-- Re-align function: when trips.departure_at changes, shift every
-- trip_stops.scheduled_at by the same delta. Preserves per-stop manual
-- edits (they shift along with the departure rather than being reset
-- to the template's offset). On route_id change we do a wholesale
-- DELETE + re-materialise — losing per-stop edits is acceptable when
-- the user has explicitly chosen a different pickup sequence.
create or replace function private.trip_stops_realign() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delta interval;
begin
  if new.route_id is distinct from old.route_id then
    delete from public.trip_stops where trip_id = new.id;
    if new.route_id is not null then
      insert into public.trip_stops (tenant_id, trip_id, ord, city, address, gps, scheduled_at)
        select new.tenant_id, new.id, rs.ord, rs.city, rs.address, rs.gps,
               new.departure_at + make_interval(mins => rs.time_offset_min)
        from public.route_stops rs
        where rs.route_id = new.route_id
        order by rs.ord;
    end if;
    return new;
  end if;

  if new.departure_at is distinct from old.departure_at then
    delta := new.departure_at - old.departure_at;
    update public.trip_stops
       set scheduled_at = scheduled_at + delta
     where trip_id = new.id;
  end if;

  return new;
end;
$$;
