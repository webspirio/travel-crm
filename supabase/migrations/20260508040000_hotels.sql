-- Phase 2.3 — hotels + hotel_room_types.
--
-- The frontend's nested `rooms: Record<RoomType, {total, pricePerNight}>`
-- is normalised into a separate table so we can index room-type pricing,
-- audit price changes, and expand schema (board basis, occupancy curves)
-- without rewriting hotels.
--
-- Per-trip room allotment is in hotel_blocks (separate migration). Why
-- not on hotels? Because allotment is a trip-level commitment with the
-- supplier, not a property of the hotel. Same hotel can be sold with 10
-- doubles on one trip and 20 on the next.

create table public.hotels (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  name          text not null,
  city          text not null,
  country       char(2) not null,
  stars         smallint check (stars between 1 and 5),
  address       text,
  notes         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index hotels_tenant_id_idx on public.hotels(tenant_id);

create trigger hotels_touch_updated_at
  before update on public.hotels
  for each row execute function private.touch_updated_at();

create trigger hotels_assert_tenant_id_immutable
  before update on public.hotels
  for each row execute function private.assert_tenant_id_immutable();

alter table public.hotels enable row level security;

create table public.hotel_room_types (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  hotel_id            uuid not null references public.hotels(id) on delete cascade,
  room_type           public.room_type not null,
  total_capacity      smallint not null check (total_capacity >= 0),
  price_per_night_eur numeric(10,2) not null check (price_per_night_eur >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (hotel_id, room_type)
);

create index hotel_room_types_tenant_id_idx on public.hotel_room_types(tenant_id);
create index hotel_room_types_hotel_id_idx  on public.hotel_room_types(hotel_id);

create trigger hotel_room_types_touch_updated_at
  before update on public.hotel_room_types
  for each row execute function private.touch_updated_at();

create trigger hotel_room_types_assert_tenant_id_immutable
  before update on public.hotel_room_types
  for each row execute function private.assert_tenant_id_immutable();

create or replace function private.hotel_room_types_assert_same_tenant() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref_tenant uuid;
begin
  select tenant_id into ref_tenant from public.hotels where id = new.hotel_id;
  if ref_tenant is null or ref_tenant <> new.tenant_id then
    raise exception 'cross-tenant FK: hotels.id=% (tenant=%) on hotel_room_types.tenant_id=%',
      new.hotel_id, ref_tenant, new.tenant_id;
  end if;
  return new;
end;
$$;

create trigger hotel_room_types_assert_same_tenant
  before insert or update on public.hotel_room_types
  for each row execute function private.hotel_room_types_assert_same_tenant();

alter table public.hotel_room_types enable row level security;
