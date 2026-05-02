-- Phase 2.3 — attach private.audit_trigger() to high-value tables.
--
-- We audit business-critical mutations only:
--   bookings, booking_passengers, payments, clients, tenant_users.
--
-- Skipped intentionally:
--   - trip_seats: too noisy (every reservation flips status; volume blows
--     up the audit_log without forensic value).
--   - hotel_blocks: changes flow through bookings, so the booking row
--     audit captures the why; auditing the block adds nothing.
--   - commission_ledger: append-only with signed amounts (the reversal
--     pattern gives the same forensic trail without doubling write
--     volume).
--   - trip_stops, trip_agents, route_stops, hotel_room_types: catalog/
--     scaffolding tables; mutations are rare and Etap 1 doesn't need a
--     forensic story for them.
--   - tenants: owner-only mutation; the tenants table is small and
--     git-blame-equivalent is enough.
--
-- audit_trigger() requires every audited table to have a `uuid id`
-- column — confirmed for all five listed below (tenant_users uses a
-- synthetic id alongside its composite PK).

create trigger bookings_audit
  after insert or update or delete on public.bookings
  for each row execute function private.audit_trigger();

create trigger booking_passengers_audit
  after insert or update or delete on public.booking_passengers
  for each row execute function private.audit_trigger();

create trigger payments_audit
  after insert or update or delete on public.payments
  for each row execute function private.audit_trigger();

create trigger clients_audit
  after insert or update or delete on public.clients
  for each row execute function private.audit_trigger();

create trigger tenant_users_audit
  after insert or update or delete on public.tenant_users
  for each row execute function private.audit_trigger();
