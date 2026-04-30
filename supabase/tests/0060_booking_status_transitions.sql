-- Phase 2 — bookings status-transition state machine.
--
-- Legal edges (from private.bookings_assert_status_transition):
--   draft          → confirmed | cancelled
--   confirmed      → partially_paid | paid | cancelled
--   partially_paid → paid | cancelled
--   paid           → no_show | cancelled
--
-- Terminal: cancelled, no_show.
-- Notably illegal: confirmed → draft, paid → confirmed, partially_paid →
-- confirmed (refunds happen via payments, not status flip).

begin;

select plan(8);

create temp table _ids (k text primary key, v uuid);

do $$
declare r record;
begin
  select tenant_id, owner_manager_id into r from tests.make_tenant_with_owner('bst', 'BST', 'bst-owner@test.local');
  insert into _ids values ('tid', r.tenant_id), ('mid', r.owner_manager_id);
end $$;

with new_row as (
  insert into public.clients (tenant_id, first_name, last_name)
values ((select v from _ids where k='tid'), 'BST', 'Client')
returning id
)
insert into _ids select 'client', id from new_row;

with new_row as (
  insert into public.trips (
tenant_id, name, destination, origin, owner_manager_id, bus_type, capacity,
departure_at, return_at, base_price_eur, child_price_eur
) values (
(select v from _ids where k='tid'), 'BST Trip', 'Rimini', 'Prague',
(select v from _ids where k='mid'), 'bus_55', 10,
now() + interval '7 days', now() + interval '14 days', 100, 50
) returning id
)
insert into _ids select 'trip', id from new_row;

create or replace function pg_temp.fresh_booking() returns uuid
language plpgsql as $$
declare bid uuid;
begin
  insert into public.bookings (tenant_id, client_id, trip_id, sold_by_manager_id)
    values ((select v from _ids where k='tid'), (select v from _ids where k='client'),
            (select v from _ids where k='trip'), (select v from _ids where k='mid'))
    returning id into bid;
  return bid;
end; $$;

-- 1: draft → confirmed legal.
select lives_ok(
  format($sql$update public.bookings set status='confirmed' where id='%s'$sql$, pg_temp.fresh_booking()),
  'draft → confirmed legal'
);

-- 2: draft → cancelled legal.
select lives_ok(
  format($sql$update public.bookings set status='cancelled' where id='%s'$sql$, pg_temp.fresh_booking()),
  'draft → cancelled legal'
);

-- 3: confirmed → paid legal (full pre-pay path).
do $$
declare bid uuid := pg_temp.fresh_booking();
begin
  update public.bookings set status='confirmed' where id=bid;
  update public.bookings set status='paid' where id=bid;
end $$;
select pass('confirmed → paid legal');

-- 4: paid → cancelled legal (refund flow).
do $$
declare bid uuid := pg_temp.fresh_booking();
begin
  update public.bookings set status='confirmed' where id=bid;
  update public.bookings set status='paid' where id=bid;
  update public.bookings set status='cancelled' where id=bid;
end $$;
select pass('paid → cancelled legal');

-- 5: confirmed → draft ILLEGAL.
select throws_ok(
  format($sql$do $body$ declare bid uuid := '%s'; begin
    update public.bookings set status='confirmed' where id=bid;
    update public.bookings set status='draft'     where id=bid;
  end $body$$sql$, pg_temp.fresh_booking()),
  '42501', null,
  'confirmed → draft rejected'
);

-- 6: paid → confirmed ILLEGAL.
select throws_ok(
  format($sql$do $body$ declare bid uuid := '%s'; begin
    update public.bookings set status='confirmed' where id=bid;
    update public.bookings set status='paid'      where id=bid;
    update public.bookings set status='confirmed' where id=bid;
  end $body$$sql$, pg_temp.fresh_booking()),
  '42501', null,
  'paid → confirmed rejected'
);

-- 7: partially_paid → confirmed ILLEGAL (refunds via payments, not status).
select throws_ok(
  format($sql$do $body$ declare bid uuid := '%s'; begin
    update public.bookings set status='confirmed'      where id=bid;
    update public.bookings set status='partially_paid' where id=bid;
    update public.bookings set status='confirmed'      where id=bid;
  end $body$$sql$, pg_temp.fresh_booking()),
  '42501', null,
  'partially_paid → confirmed rejected'
);

-- 8: cancelled is terminal — cancelled → confirmed ILLEGAL.
select throws_ok(
  format($sql$do $body$ declare bid uuid := '%s'; begin
    update public.bookings set status='cancelled' where id=bid;
    update public.bookings set status='confirmed' where id=bid;
  end $body$$sql$, pg_temp.fresh_booking()),
  '42501', null,
  'cancelled is terminal: cancelled → confirmed rejected'
);

select * from finish();

rollback;
