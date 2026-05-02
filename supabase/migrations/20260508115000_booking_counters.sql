-- Phase 2.3 — booking_counters + private.next_booking_number().
--
-- Row-locked counter, gapless within (tenant_id, year). The bookings
-- BEFORE INSERT trigger calls private.next_booking_number(tenant_id);
-- the SAME generator runs from the confirmed-transition trigger to
-- populate contract_number. Aborted booking transactions roll back the
-- counter increment automatically because the INSERT…ON CONFLICT…
-- UPDATE is part of the booking transaction.
--
-- Why not a per-(tenant, year) sequence? Sequences are gap-prone (rolled-
-- back transactions burn the value). German civil-contract law for
-- AnyTour's domain doesn't require gapless numbering, but the operations
-- team's expectation from the Excel-era workflow does. Counter table
-- gives us gapless behaviour at the cost of a per-tenant-year hot row
-- — fine at AnyTour's volume.
--
-- Format: <2-digit year><3-digit sequence>, e.g. '26001'.
-- Re-prefix to '<year>NNN' or longer if a tenant ever exceeds 999 in a
-- year (Etap 2 problem).

create table public.booking_counters (
  -- Synthetic id so the audit_trigger pattern can attach if we ever
  -- audit this table. Not currently audited.
  id           uuid not null default gen_random_uuid() unique,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  year         smallint not null,
  last_seq     integer not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (tenant_id, year)
);

alter table public.booking_counters enable row level security;

-- No write policy for authenticated. The next_booking_number function
-- runs as security definer and bypasses RLS. Owners can SELECT for
-- visibility into the next-number state.

create or replace function private.next_booking_number(_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  yr  smallint := pg_catalog.date_part('year', now())::smallint;
  seq integer;
begin
  insert into public.booking_counters (tenant_id, year, last_seq, updated_at)
       values (_tenant_id, yr, 1, now())
  on conflict (tenant_id, year)
    do update set last_seq   = public.booking_counters.last_seq + 1,
                  updated_at = now()
  returning last_seq into seq;

  -- '26' for year 2026, then 3-digit zero-padded sequence: '26001'.
  return pg_catalog.to_char(yr % 100, 'FM00')
      || pg_catalog.lpad(seq::text, 3, '0');
end;
$$;

revoke all on function private.next_booking_number(uuid) from public;
-- Not granted to authenticated — only invoked from BEFORE INSERT triggers
-- on bookings (which run as security definer themselves).
