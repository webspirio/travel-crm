-- Phase 2.3 — payments.
--
-- One row per money receipt. Phase 3 wires a trigger that updates
-- bookings.paid_amount_eur and possibly transitions status (confirmed →
-- partially_paid → paid). Etap 1 keeps payment INSERTs explicit; the
-- frontend calls a transaction that inserts + updates the booking.
--
-- Refunds are negative-amount rows (signed) — the lifecycle from
-- bookings_assert_status_transition allows paid → cancelled, which
-- triggers the refund row at the application layer.

create table public.payments (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  booking_id                  uuid not null references public.bookings(id) on delete restrict,
  amount_eur                  numeric(10,2) not null,
  method                      public.payment_method not null,
  received_at                 timestamptz not null default now(),
  received_by_manager_id      uuid references public.managers(id) on delete set null,
  reference                   text,
  notes                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index payments_tenant_id_idx        on public.payments(tenant_id);
create index payments_booking_id_idx       on public.payments(booking_id);
create index payments_received_at_idx      on public.payments(tenant_id, received_at desc);
create index payments_received_by_idx      on public.payments(received_by_manager_id) where received_by_manager_id is not null;

create trigger payments_touch_updated_at
  before update on public.payments
  for each row execute function private.touch_updated_at();

create trigger payments_assert_tenant_id_immutable
  before update on public.payments
  for each row execute function private.assert_tenant_id_immutable();

create or replace function private.payments_assert_same_tenant() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref_tenant uuid;
begin
  select tenant_id into ref_tenant from public.bookings where id = new.booking_id;
  if ref_tenant is null or ref_tenant <> new.tenant_id then
    raise exception 'cross-tenant FK: bookings.id=% (tenant=%) on payments.tenant_id=%',
      new.booking_id, ref_tenant, new.tenant_id;
  end if;

  if new.received_by_manager_id is not null then
    select tenant_id into ref_tenant from public.managers where id = new.received_by_manager_id;
    if ref_tenant is null or ref_tenant <> new.tenant_id then
      raise exception 'cross-tenant FK: managers.id=% (tenant=%) on payments.tenant_id=%',
        new.received_by_manager_id, ref_tenant, new.tenant_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger payments_assert_same_tenant
  before insert or update on public.payments
  for each row execute function private.payments_assert_same_tenant();

alter table public.payments enable row level security;
