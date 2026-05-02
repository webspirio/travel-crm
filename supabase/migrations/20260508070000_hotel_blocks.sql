-- Phase 2.3 — hotel_blocks.
--
-- Per-trip allotment of rooms at a specific hotel and room_type. The
-- standard oversell guard at booking time is:
--
--   update public.hotel_blocks
--      set qty_used = qty_used + :n
--    where trip_id = :trip and hotel_id = :hotel and room_type = :rt
--      and qty_used + :n <= qty_total
--   returning *;
--
-- Zero rows back ⇒ allotment exhausted; surface "no rooms" to the user.
-- Atomic at the row level (no SELECT … FOR UPDATE needed). Phase 3 wires
-- this into the booking transaction.

create table public.hotel_blocks (
  id              uuid not null default gen_random_uuid() unique,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  trip_id         uuid not null references public.trips(id) on delete cascade,
  hotel_id        uuid not null references public.hotels(id) on delete restrict,
  room_type       public.room_type not null,
  qty_total       smallint not null check (qty_total >= 0),
  qty_used        smallint not null default 0 check (qty_used >= 0),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (trip_id, hotel_id, room_type),
  check (qty_used <= qty_total)
);

create index hotel_blocks_tenant_id_idx on public.hotel_blocks(tenant_id);
create index hotel_blocks_trip_id_idx   on public.hotel_blocks(trip_id);
create index hotel_blocks_hotel_id_idx  on public.hotel_blocks(hotel_id);

create trigger hotel_blocks_touch_updated_at
  before update on public.hotel_blocks
  for each row execute function private.touch_updated_at();

create trigger hotel_blocks_aa_assert_tenant_id_immutable
  before update on public.hotel_blocks
  for each row execute function private.assert_tenant_id_immutable();

create or replace function private.hotel_blocks_assert_same_tenant() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref_tenant uuid;
begin
  select tenant_id into ref_tenant from public.trips where id = new.trip_id;
  if ref_tenant is null or ref_tenant <> new.tenant_id then
    raise exception 'cross-tenant FK: trips.id=% (tenant=%) on hotel_blocks.tenant_id=%',
      new.trip_id, ref_tenant, new.tenant_id;
  end if;

  select tenant_id into ref_tenant from public.hotels where id = new.hotel_id;
  if ref_tenant is null or ref_tenant <> new.tenant_id then
    raise exception 'cross-tenant FK: hotels.id=% (tenant=%) on hotel_blocks.tenant_id=%',
      new.hotel_id, ref_tenant, new.tenant_id;
  end if;

  return new;
end;
$$;

create trigger hotel_blocks_assert_same_tenant
  before insert or update on public.hotel_blocks
  for each row execute function private.hotel_blocks_assert_same_tenant();

alter table public.hotel_blocks enable row level security;
