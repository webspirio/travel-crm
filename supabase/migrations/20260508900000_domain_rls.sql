-- Phase 2.4 — consolidated RLS policies for every domain table + the
-- bookings_select_scoped helper + the bookings status state-machine.
--
-- One file per source-plan §2.4 so the role/policy matrix is a single
-- grep. Naming convention: <table>_<action>_<scope> (Phase 1 set this).
--
-- Base shape per source plan §2.4:
--   SELECT to authenticated using has_role_on_tenant
--   INSERT to authenticated with check has_role_on_tenant(owner|manager)
--   UPDATE to authenticated using/with-check has_role_on_tenant(owner|manager)
--   DELETE to authenticated using has_role_on_tenant(owner)
--
-- Wrapping has_role_on_tenant in `(select ...)` pulls the call into an
-- InitPlan that runs once per query rather than once per row (Makerkit
-- pattern, materially cheaper on the hot list paths).
--
-- Per-entity overrides:
--   - bookings: scope = seller OR trip-owner OR trip-agent (managers);
--     owners + accountants see all. Driven by
--     private.bookings_visible_trip_ids(tenant_id) so the planner evaluates
--     the visible-trips set as an InitPlan.
--   - payments: scoped via bookings (same shape).
--   - commission_ledger: managers see own rows only.
--   - booking_counters: owners SELECT only.
--   - audit_log: owner+accountant SELECT (already created in Phase 1).
--   - clients + bookings: soft-delete pair (members see live; owners
--     additionally see deleted via a parallel policy).
--   - managers: owners only mutate; agents/managers don't manage staff.

-- ===================================================================
-- Helper for bookings/payments scope.
-- ===================================================================

-- Returns the set of trip_ids in the given tenant that the current
-- manager owns OR is assigned to as a trip_agent. Used by
-- bookings_select_scoped (and the equivalent payments policy via the
-- inherited bookings filter). Tenant-scoped so multi-tenant users
-- resolve to the right manager row per-tenant.
create or replace function private.bookings_visible_trip_ids(_tenant_id uuid)
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select t.id
    from public.trips t
   where t.tenant_id = _tenant_id
     and t.owner_manager_id = (select private.current_manager_id(_tenant_id))
   union
  select ta.trip_id
    from public.trip_agents ta
   where ta.tenant_id = _tenant_id
     and ta.manager_id = (select private.current_manager_id(_tenant_id));
$$;

revoke all on function private.bookings_visible_trip_ids(uuid) from public;
grant execute on function private.bookings_visible_trip_ids(uuid) to authenticated;

-- ===================================================================
-- Trip occupancy — opaque view for the seat map.
-- ===================================================================
--
-- bookings_select_scoped restricts which booking rows a manager can read.
-- The seat map needs to render true occupancy regardless of booking
-- visibility — a manager who is neither the seller nor a trip_agent on a
-- given trip must still see "this seat is taken" so they don't try to
-- sell it. SECURITY DEFINER lets this function bypass bookings RLS, but
-- the explicit has_role_on_tenant check keeps cross-tenant calls out.
-- The function returns only seat_number + paid flag — no PII.
create or replace function public.trip_occupied_seat_numbers(_trip_id uuid)
returns table(seat_number smallint, paid boolean)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  trip_tenant uuid;
begin
  select tenant_id into trip_tenant from public.trips where id = _trip_id;
  if trip_tenant is null then
    raise exception 'trip not found' using errcode = 'P0002';
  end if;
  if not (select private.has_role_on_tenant(trip_tenant)) then
    raise exception 'access denied' using errcode = '42501';
  end if;

  return query
    select bp.seat_number, (b.status = 'paid')::boolean
      from public.booking_passengers bp
      join public.bookings b on b.id = bp.booking_id
     where bp.trip_id = _trip_id
       and bp.seat_number is not null
       and b.deleted_at is null
       and b.status in ('confirmed', 'partially_paid', 'paid');
end;
$$;

revoke all on function public.trip_occupied_seat_numbers(uuid) from public;
revoke all on function public.trip_occupied_seat_numbers(uuid) from anon;
grant execute on function public.trip_occupied_seat_numbers(uuid) to authenticated;

-- ===================================================================
-- Booking lifecycle state-machine.
-- ===================================================================
--
-- Encodes the documented status graph. Terminal: cancelled, no_show.
-- partially_paid → confirmed is NOT allowed: once money has been taken,
-- backing out requires a refund flow (payments reversal), not a status
-- flip. INSERT is constrained to status='draft' — every booking must
-- enter the lifecycle through the documented starting state.

create or replace function private.bookings_assert_status_transition() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- INSERT: only 'draft' is a legal starting state. Without this guard,
  -- a caller could INSERT directly into 'paid' / 'no_show' / etc. and
  -- skip the state machine entirely.
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'bookings must start in status=draft, got %', new.status
        using errcode = '42501';
    end if;
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  if (old.status, new.status) in (
    ('draft',          'confirmed'),       ('draft',          'cancelled'),
    ('confirmed',      'partially_paid'),  ('confirmed',      'paid'),
    ('confirmed',      'cancelled'),
    ('partially_paid', 'paid'),            ('partially_paid', 'cancelled'),
    ('paid',           'no_show'),         ('paid',           'cancelled')
  ) then
    return new;
  end if;

  raise exception 'illegal booking_status transition: % -> %', old.status, new.status
    using errcode = '42501';
end;
$$;

create trigger bookings_assert_status_transition
  before insert or update of status on public.bookings
  for each row execute function private.bookings_assert_status_transition();

-- ===================================================================
-- managers
-- ===================================================================

create policy managers_select_members on public.managers
  for select to authenticated
  using ((select private.has_role_on_tenant(tenant_id)));

create policy managers_insert_owners on public.managers
  for insert to authenticated
  with check ((select private.has_role_on_tenant(tenant_id, array['owner']::public.tenant_role[])));

create policy managers_update_owners on public.managers
  for update to authenticated
  using      ((select private.has_role_on_tenant(tenant_id, array['owner']::public.tenant_role[])))
  with check ((select private.has_role_on_tenant(tenant_id, array['owner']::public.tenant_role[])));

create policy managers_delete_owners on public.managers
  for delete to authenticated
  using ((select private.has_role_on_tenant(tenant_id, array['owner']::public.tenant_role[])));

-- ===================================================================
-- clients (with soft-delete pair)
-- ===================================================================

-- Live rows visible to all members.
create policy clients_select_members on public.clients
  for select to authenticated
  using (
    (select private.has_role_on_tenant(tenant_id))
    and deleted_at is null
  );

-- Soft-deleted rows visible only to owners (restoration UI in Etap 2).
create policy clients_select_deleted_owners on public.clients
  for select to authenticated
  using (
    (select private.has_role_on_tenant(tenant_id, array['owner']::public.tenant_role[]))
    and deleted_at is not null
  );

create policy clients_insert_managers on public.clients
  for insert to authenticated
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy clients_update_managers on public.clients
  for update to authenticated
  using      ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])))
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy clients_delete_owners on public.clients
  for delete to authenticated
  using ((select private.has_role_on_tenant(tenant_id, array['owner']::public.tenant_role[])));

-- ===================================================================
-- routes + route_stops
-- ===================================================================

create policy routes_select_members on public.routes
  for select to authenticated
  using ((select private.has_role_on_tenant(tenant_id)));

create policy routes_insert_managers on public.routes
  for insert to authenticated
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy routes_update_managers on public.routes
  for update to authenticated
  using      ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])))
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy routes_delete_owners on public.routes
  for delete to authenticated
  using ((select private.has_role_on_tenant(tenant_id, array['owner']::public.tenant_role[])));

create policy route_stops_select_members on public.route_stops
  for select to authenticated
  using ((select private.has_role_on_tenant(tenant_id)));

create policy route_stops_insert_managers on public.route_stops
  for insert to authenticated
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy route_stops_update_managers on public.route_stops
  for update to authenticated
  using      ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])))
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy route_stops_delete_managers on public.route_stops
  for delete to authenticated
  using ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

-- ===================================================================
-- hotels + hotel_room_types
-- ===================================================================

create policy hotels_select_members on public.hotels
  for select to authenticated
  using ((select private.has_role_on_tenant(tenant_id)));

create policy hotels_insert_managers on public.hotels
  for insert to authenticated
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy hotels_update_managers on public.hotels
  for update to authenticated
  using      ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])))
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy hotels_delete_owners on public.hotels
  for delete to authenticated
  using ((select private.has_role_on_tenant(tenant_id, array['owner']::public.tenant_role[])));

create policy hotel_room_types_select_members on public.hotel_room_types
  for select to authenticated
  using ((select private.has_role_on_tenant(tenant_id)));

create policy hotel_room_types_insert_managers on public.hotel_room_types
  for insert to authenticated
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy hotel_room_types_update_managers on public.hotel_room_types
  for update to authenticated
  using      ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])))
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy hotel_room_types_delete_managers on public.hotel_room_types
  for delete to authenticated
  using ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

-- ===================================================================
-- trips + trip_agents + trip_stops + trip_seats
-- ===================================================================

create policy trips_select_members on public.trips
  for select to authenticated
  using ((select private.has_role_on_tenant(tenant_id)));

create policy trips_insert_managers on public.trips
  for insert to authenticated
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy trips_update_managers on public.trips
  for update to authenticated
  using      ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])))
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy trips_delete_owners on public.trips
  for delete to authenticated
  using ((select private.has_role_on_tenant(tenant_id, array['owner']::public.tenant_role[])));

create policy trip_agents_select_members on public.trip_agents
  for select to authenticated
  using ((select private.has_role_on_tenant(tenant_id)));

create policy trip_agents_write_managers on public.trip_agents
  for all to authenticated
  using      ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])))
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy trip_stops_select_members on public.trip_stops
  for select to authenticated
  using ((select private.has_role_on_tenant(tenant_id)));

-- trip_stops INSERT/DELETE flow through the materialise/realign triggers
-- (security definer, bypass RLS as postgres-owned). Manual UPDATE of
-- scheduled_at by managers is allowed.
create policy trip_stops_update_managers on public.trip_stops
  for update to authenticated
  using      ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])))
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy trip_seats_select_members on public.trip_seats
  for select to authenticated
  using ((select private.has_role_on_tenant(tenant_id)));

-- INSERTs are trigger-driven (security definer); no INSERT policy for
-- authenticated. UPDATE is the booking flow's seat-hold path.
create policy trip_seats_update_managers on public.trip_seats
  for update to authenticated
  using      ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])))
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

-- ===================================================================
-- hotel_blocks
-- ===================================================================

create policy hotel_blocks_select_members on public.hotel_blocks
  for select to authenticated
  using ((select private.has_role_on_tenant(tenant_id)));

create policy hotel_blocks_insert_managers on public.hotel_blocks
  for insert to authenticated
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy hotel_blocks_update_managers on public.hotel_blocks
  for update to authenticated
  using      ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])))
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy hotel_blocks_delete_managers on public.hotel_blocks
  for delete to authenticated
  using ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

-- ===================================================================
-- bookings (scoped) + booking_passengers + soft-delete pair
-- ===================================================================

-- Live + scoped to seller / trip-owner / trip-agent. Owners and
-- accountants see all live rows.
create policy bookings_select_scoped on public.bookings
  for select to authenticated
  using (
    deleted_at is null
    and (
      (select private.has_role_on_tenant(tenant_id, array['owner','accountant']::public.tenant_role[]))
      OR sold_by_manager_id = (select private.current_manager_id(tenant_id))
      OR trip_id in (select private.bookings_visible_trip_ids(tenant_id))
    )
  );

-- Owner-only view of soft-deleted bookings (for restoration UI).
create policy bookings_select_deleted_owners on public.bookings
  for select to authenticated
  using (
    (select private.has_role_on_tenant(tenant_id, array['owner']::public.tenant_role[]))
    and deleted_at is not null
  );

create policy bookings_insert_managers on public.bookings
  for insert to authenticated
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy bookings_update_managers on public.bookings
  for update to authenticated
  using      ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])))
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy bookings_delete_owners on public.bookings
  for delete to authenticated
  using ((select private.has_role_on_tenant(tenant_id, array['owner']::public.tenant_role[])));

-- booking_passengers: scope inherited via the booking_id sub-select.
-- The has_role_on_tenant predicate is defense-in-depth alongside the
-- same-tenant trigger (which catches cross-tenant FKs at write time);
-- without it, the SELECT policy would be one layer thinner than every
-- other domain table.
create policy booking_passengers_select_scoped on public.booking_passengers
  for select to authenticated
  using (
    (select private.has_role_on_tenant(tenant_id))
    and booking_id in (select id from public.bookings)
  );

create policy booking_passengers_insert_managers on public.booking_passengers
  for insert to authenticated
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy booking_passengers_update_managers on public.booking_passengers
  for update to authenticated
  using      ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])))
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy booking_passengers_delete_managers on public.booking_passengers
  for delete to authenticated
  using ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

-- ===================================================================
-- payments (scoped via bookings)
-- ===================================================================

create policy payments_select_scoped on public.payments
  for select to authenticated
  using (
    (select private.has_role_on_tenant(tenant_id))
    and booking_id in (select id from public.bookings)
  );

create policy payments_insert_managers on public.payments
  for insert to authenticated
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy payments_update_managers on public.payments
  for update to authenticated
  using      ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])))
  with check ((select private.has_role_on_tenant(tenant_id, array['owner','manager']::public.tenant_role[])));

create policy payments_delete_owners on public.payments
  for delete to authenticated
  using ((select private.has_role_on_tenant(tenant_id, array['owner']::public.tenant_role[])));

-- ===================================================================
-- commission_ledger
-- ===================================================================

-- Managers see own rows only; owners + accountants see all.
create policy commission_ledger_select_scoped on public.commission_ledger
  for select to authenticated
  using (
    (select private.has_role_on_tenant(tenant_id, array['owner','accountant']::public.tenant_role[]))
    OR manager_id = (select private.current_manager_id(tenant_id))
  );

-- Append-only: INSERT goes through the Phase-3 accrual trigger (security
-- definer, bypasses RLS). No INSERT/UPDATE/DELETE policies for app users
-- — by default RLS denies any operation without a matching policy.

-- ===================================================================
-- booking_counters
-- ===================================================================

-- Owners can SELECT (visibility into next-number state). The counter is
-- written by private.next_booking_number which runs as security definer
-- and bypasses RLS.
create policy booking_counters_select_owners on public.booking_counters
  for select to authenticated
  using ((select private.has_role_on_tenant(tenant_id, array['owner']::public.tenant_role[])));
