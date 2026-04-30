-- Phase 2.2 — domain enums.
--
-- Eight closed-world enums defined up-front so generated TS types ship
-- literal-union types (not text). Adding a value later costs ALTER TYPE,
-- which is hot-path-painful — so where the domain has even a chance of
-- gaining a value (passenger kind, payment method) we still pick the
-- minimal set Etap 1 actually uses.
--
-- Encoding choices:
--   - bus_type uses bus_55 / bus_79 keys so they're valid SQL identifiers;
--     frontend keeps '55' / '79' via src/lib/bus.ts translation map.
--   - trip_status renames 'in-progress' → 'in_progress' for the same reason.
--   - seat_status drops the frontend's 'selected' (UI-only state — no DB
--     row needs it).
--   - commission_status includes 'reversed' so cancellation-after-accrual
--     is an append (negative-amount row) rather than an update on the
--     original row. Append-only ledger semantics.

create type public.passenger_kind as enum (
  'adult',
  'child',
  'infant'
);

create type public.booking_status as enum (
  'draft',
  'confirmed',
  'partially_paid',
  'paid',
  'cancelled',
  'no_show'
);

create type public.trip_status as enum (
  'planned',
  'booking',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled'
);

create type public.seat_status as enum (
  'free',
  'reserved',
  'sold',
  'blocked'
);

create type public.room_type as enum (
  'single',
  'double',
  'triple',
  'family'
);

create type public.bus_type as enum (
  'bus_55',
  'bus_79'
);

create type public.payment_method as enum (
  'cash',
  'bank_transfer',
  'card'
);

create type public.commission_status as enum (
  'accrued',
  'paid',
  'reversed'
);
