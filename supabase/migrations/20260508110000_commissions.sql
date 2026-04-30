-- Phase 2.3 — commission_ledger.
--
-- Append-only with signed amounts (Decision: Round 2 #10). Cancellation
-- after accrual inserts a row with status='reversed' and amount =
-- -original; the original 'accrued' row is never updated. This gives
-- the same forensic trail as a separate audit table without doubling
-- write volume — which is why commission_ledger is NOT in the audit-
-- attach migration.
--
-- Phase 2 ships the table only. Phase 3 wires the accrual trigger that
-- inserts on bookings INSERT (status='confirmed') and on confirmed-
-- transition. The cancel/refund trigger inserts the reversal row.

create table public.commission_ledger (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  booking_id      uuid not null references public.bookings(id) on delete restrict,
  manager_id      uuid not null references public.managers(id) on delete restrict,
  amount_eur      numeric(10,2) not null,
  status          public.commission_status not null,
  accrued_at      timestamptz not null default now(),
  paid_at         timestamptz,
  reversed_at     timestamptz,
  notes           text,
  created_at      timestamptz not null default now()
);

create index commission_ledger_tenant_id_idx   on public.commission_ledger(tenant_id);
create index commission_ledger_booking_id_idx  on public.commission_ledger(booking_id);
create index commission_ledger_manager_id_idx  on public.commission_ledger(manager_id);
create index commission_ledger_status_idx      on public.commission_ledger(tenant_id, status);

-- No touch_updated_at — append-only, no updated_at column. The status
-- timestamps (paid_at, reversed_at) are set explicitly when the
-- corresponding row is inserted.

create trigger commission_ledger_aa_assert_tenant_id_immutable
  before update on public.commission_ledger
  for each row execute function private.assert_tenant_id_immutable();

create or replace function private.commission_ledger_assert_same_tenant() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref_tenant uuid;
begin
  select tenant_id into ref_tenant from public.bookings where id = new.booking_id;
  if ref_tenant is null or ref_tenant <> new.tenant_id then
    raise exception 'cross-tenant FK: bookings.id=% (tenant=%) on commission_ledger.tenant_id=%',
      new.booking_id, ref_tenant, new.tenant_id;
  end if;

  select tenant_id into ref_tenant from public.managers where id = new.manager_id;
  if ref_tenant is null or ref_tenant <> new.tenant_id then
    raise exception 'cross-tenant FK: managers.id=% (tenant=%) on commission_ledger.tenant_id=%',
      new.manager_id, ref_tenant, new.tenant_id;
  end if;

  return new;
end;
$$;

create trigger commission_ledger_assert_same_tenant
  before insert or update on public.commission_ledger
  for each row execute function private.commission_ledger_assert_same_tenant();

alter table public.commission_ledger enable row level security;
