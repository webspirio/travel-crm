-- Local-dev seed. Runs after migrations on `npm run db:reset` and at the
-- start of every `supabase test db` invocation. NOT deployed to production
-- (only migrations are pushed remote), so this is the right place for
-- test-only extensions and fixture helpers.

create extension if not exists pgtap with schema extensions;

-- ----------------------------------------------------------------------
-- pgTap fixture helpers — defined here (rather than in supabase/tests/)
-- because pg_prove discovers any *.sql under tests/ as a test file.
--
-- Security model: helpers are owned by `postgres` and NOT granted to
-- `authenticated`. Tests invoke `make_tenant`/`make_member` only while
-- the session role is `postgres` (i.e. before role-switching to
-- `authenticated` for RLS assertions). After assertions, tests revert
-- with `reset role; reset request.jwt.claims` — no helper call needed,
-- so no schema USAGE grant to `authenticated` is required.
--
-- Why this matters: a previous design granted execute on these helpers
-- to `authenticated`, which would let any reachable authenticated session
-- promote itself to owner via tests.make_member(...). Locked down here.
-- ----------------------------------------------------------------------

create schema if not exists tests;
revoke all on schema tests from public, anon, authenticated;

-- Switch the current session to `authenticated` and pretend to be the
-- given email. RLS policies that call auth.uid() will see this user's id.
-- Reset by issuing `reset role; reset request.jwt.claims` (no helper).
create or replace function tests.impersonate_user(_email text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  uid uuid;
  claims jsonb;
begin
  select id into uid from auth.users where email = _email;
  if uid is null then
    raise exception 'tests.impersonate_user: no auth.users row for email=%', _email;
  end if;
  claims := pg_catalog.jsonb_build_object('sub', uid::text, 'role', 'authenticated');
  perform pg_catalog.set_config('request.jwt.claims', claims::text, true);
  perform pg_catalog.set_config('role', 'authenticated', true);
end;
$$;

-- Insert a tenants row and return its id. Slug normalisation runs in the
-- BEFORE INSERT trigger.
create or replace function tests.make_tenant(_slug text, _name text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  tid uuid;
begin
  insert into public.tenants (slug, name) values (_slug, _name) returning id into tid;
  return tid;
end;
$$;

-- Create an auth.users row and a tenant_users membership. Returns the
-- new user's uuid. Direct insert into auth.users (skipping GoTrue) is
-- safe inside a test transaction — the data is rolled back. The column
-- list is dependent on Supabase's auth.users schema; CLI upgrades that
-- add NOT NULL columns may break this — re-sync from auth.users \d if so.
create or replace function tests.make_member(
  _tenant_id uuid,
  _email text,
  _role public.tenant_role,
  _is_active boolean default true
) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := pg_catalog.gen_random_uuid();
begin
  -- GoTrue's Go scanner cannot read NULL into its string-typed token
  -- columns; bypassing the API to insert directly leaves them NULL by
  -- default and breaks /token (sign-in) with "Database error querying
  -- schema". Set them to empty strings to match what GoTrue's own
  -- migrations write for users created via its API.
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change_token_current, email_change,
    reauthentication_token, phone_change, phone_change_token
  )
  values (
    uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', _email,
    extensions.crypt('test-password', extensions.gen_salt('bf')),
    pg_catalog.now(), pg_catalog.now(), pg_catalog.now(),
    '', '', '', '', '', '', '', ''
  );

  insert into public.tenant_users (tenant_id, user_id, role, is_active)
  values (_tenant_id, uid, _role, _is_active);

  return uid;
end;
$$;

-- Create an auth.users row + tenant_users membership + managers row in
-- one shot, returning the managers.id. Used by Phase 2 tests that need a
-- manager for FK targets (bookings.sold_by_manager_id, trips.owner_manager_id).
create or replace function tests.make_manager(
  _tenant_id uuid,
  _email text,
  _role public.tenant_role default 'manager',
  _display_name text default null
) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  uid uuid;
  mid uuid;
begin
  uid := tests.make_member(_tenant_id, _email, _role, true);
  insert into public.managers (tenant_id, user_id, display_name, email)
  values (_tenant_id, uid,
          coalesce(_display_name, pg_catalog.split_part(_email, '@', 1)),
          _email)
  returning id into mid;
  return mid;
end;
$$;

-- Create a tenant + owner-membership + manager row in one shot, returning
-- the new manager_id. Convenience for tests that don't care about the
-- intermediate ids.
create or replace function tests.make_tenant_with_owner(
  _slug text,
  _name text,
  _owner_email text
) returns table (tenant_id uuid, owner_manager_id uuid)
language plpgsql
set search_path = ''
as $$
declare
  tid uuid;
  mid uuid;
begin
  tid := tests.make_tenant(_slug, _name);
  mid := tests.make_manager(tid, _owner_email, 'owner');
  return query select tid, mid;
end;
$$;

-- ----------------------------------------------------------------------
-- Dev seed: AnyTour tenant with realistic fixtures so the frontend has
-- something to render after `npm run db:reset`. Idempotent — wraps
-- everything in a single DO block guarded by a tenant slug check, so
-- repeated runs (without the reset) don't crash on unique violations.
-- The fixtures roughly mirror src/data/* mock data: 1 tenant, 4
-- managers, 10 hotels (with room types), 1 route, 8 trips (varying
-- statuses), 30 clients, ~30 bookings.
-- ----------------------------------------------------------------------

do $seed$
#variable_conflict use_column
declare
  tid uuid;
  owner_uid uuid;
  owner_mid uuid;
  mid_olena uuid;
  mid_andreas uuid;
  mid_petra uuid;
  v_route_id uuid;
  hotel_ids uuid[];
  trip_ids uuid[];
  client_ids uuid[];
  i int;
  j int;
  v_trip_id uuid;
  v_client_id uuid;
  v_hotel_id uuid;
  v_booking_id uuid;
  free_seat smallint;
begin
  -- Skip if already seeded.
  if exists (select 1 from public.tenants where slug = 'anytour-dev') then
    raise notice 'dev seed already present, skipping';
    return;
  end if;

  insert into public.tenants (slug, name, default_locale)
    values ('anytour-dev', 'AnyTour Dev', 'uk') returning id into tid;

  -- Owner + 3 managers (auth.users + tenant_users + managers).
  owner_uid := tests.make_member(tid, 'owner@anytour.dev', 'owner');
  insert into public.managers (tenant_id, user_id, display_name, email, phone)
    values (tid, owner_uid, 'Ivan Kovalenko', 'owner@anytour.dev', '+49 30 12345678')
    returning id into owner_mid;

  mid_olena := tests.make_manager(tid, 'olena@anytour.dev', 'manager', 'Olena Shevchenko');
  mid_andreas := tests.make_manager(tid, 'andreas@anytour.dev', 'manager', 'Andreas Schmidt');
  mid_petra := tests.make_manager(tid, 'petra@anytour.dev', 'manager', 'Petra Becker');

  -- One route.
  insert into public.routes (tenant_id, name, description)
    values (tid, 'Berlin → Adriatic Coast', 'Standard 4-stop pickup sequence')
    returning id into v_route_id;

  insert into public.route_stops (tenant_id, route_id, ord, city, time_offset_min) values
    (tid, v_route_id, 1, 'Berlin',     0),
    (tid, v_route_id, 2, 'Nuremberg', 240),
    (tid, v_route_id, 3, 'Munich',    420),
    (tid, v_route_id, 4, 'Augsburg',  480);

  -- 10 hotels with 4 room types each. Writable CTE collects the ids
  -- in order; INSERT-returning-array isn't directly supported.
  with new_hotels as (
    insert into public.hotels (tenant_id, name, city, country, stars) values
      (tid, 'Hotel Bellavista',       'Rimini',         'IT', 4),
      (tid, 'Grand Hotel Adriatico',  'Rimini',         'IT', 5),
      (tid, 'Residence Mare Blu',     'Riccione',       'IT', 3),
      (tid, 'Hotel Sole & Luna',      'Riccione',       'IT', 4),
      (tid, 'Hotel Costa Verde',      'Cattolica',      'IT', 4),
      (tid, 'Villa Ester',            'Cattolica',      'IT', 3),
      (tid, 'Hotel San Marco',        'Bellaria',       'IT', 4),
      (tid, 'Palace Hotel Venezia',   'Lido di Jesolo', 'IT', 5),
      (tid, 'Hotel Riviera',          'Lido di Jesolo', 'IT', 4),
      (tid, 'Hotel Azzurro',          'Caorle',         'IT', 3)
    returning id, name
  )
  select array_agg(id order by name) into hotel_ids from new_hotels;

  -- Room types per hotel.
  insert into public.hotel_room_types (tenant_id, hotel_id, room_type, total_capacity, price_per_night_eur)
    select tid, h, rt, cap, price
    from unnest(hotel_ids) as h
    cross join lateral (
      values
        ('single'::public.room_type, 6, 110),
        ('double'::public.room_type, 25, 145),
        ('triple'::public.room_type, 12, 195),
        ('family'::public.room_type, 6, 250)
    ) as t(rt, cap, price);

  -- 8 trips spanning May–Aug 2026; varying statuses + bus types.
  trip_ids := array_fill(null::uuid, array[8]);

  for i in 1..8 loop
    insert into public.trips (
      tenant_id, name, destination, origin, route_id, owner_manager_id,
      bus_type, capacity, departure_at, return_at, status,
      base_price_eur, child_price_eur, infant_price_eur,
      front_rows_count, front_rows_surcharge_eur
    ) values (
      tid,
      'Berlin → ' || (array['Rimini','Riccione','Cattolica','Bellaria','Lido di Jesolo','Caorle','Rimini','Riccione'])[i],
      (array['Rimini','Riccione','Cattolica','Bellaria','Lido di Jesolo','Caorle','Rimini','Riccione'])[i],
      'Berlin',
      v_route_id,
      (array[owner_mid, mid_olena, mid_andreas, mid_petra])[1 + ((i-1) % 4)],
      (case when i % 2 = 0 then 'bus_55' else 'bus_79' end)::public.bus_type,
      (case when i % 2 = 0 then 55 else 79 end),
      '2026-05-01'::timestamptz + ((i - 1) * interval '14 days'),
      '2026-05-08'::timestamptz + ((i - 1) * interval '14 days'),
      (array['planned','booking','confirmed','confirmed','in_progress','completed','planned','booking'])[i]::public.trip_status,
      (650 + i * 30)::numeric,                -- base
      (450 + i * 20)::numeric,                -- child
      0,
      4,                                      -- front rows
      30                                      -- front-row surcharge
    ) returning id into v_trip_id;
    trip_ids[i] := v_trip_id;
  end loop;

  -- Trip-agent assignments: olena agents on trip 1, andreas on trip 2.
  insert into public.trip_agents (tenant_id, trip_id, manager_id) values
    (tid, trip_ids[1], mid_olena),
    (tid, trip_ids[2], mid_andreas);

  -- Hotel blocks: each trip gets 2-3 hotels with allotment.
  for i in 1..8 loop
    for j in 1..3 loop
      insert into public.hotel_blocks (tenant_id, trip_id, hotel_id, room_type, qty_total, qty_used)
      values (
        tid,
        trip_ids[i],
        hotel_ids[1 + ((i + j) % array_length(hotel_ids, 1))],
        (array['double','triple','family'])[j]::public.room_type,
        (array[20, 8, 4])[j],
        0
      ) on conflict do nothing;
    end loop;
  end loop;

  -- 30 clients (mix of UA/DE).
  client_ids := array_fill(null::uuid, array[30]);
  for i in 1..30 loop
    insert into public.clients (tenant_id, first_name, last_name, email, phone, nationality, birth_date)
    values (
      tid,
      (array['Anna','Maria','Olha','Petr','Ivan','Klaus','Stefan','Helena','Yulia','Markus',
             'Olena','Sergiy','Tatiana','Vasyl','Halyna','Bogdan','Iryna','Mykola','Oksana','Andriy',
             'Sabine','Christian','Daniela','Heinrich','Susanne','Walter','Brigitte','Wolfgang','Renate','Werner'])[i],
      (array['Iv','Schmidt','Petr','Schwarz','Kuznetsov','Müller','Bauer','Voloshyn','Pavlenko','Schwarz',
             'Bondar','Sereda','Kovach','Hutsalo','Lysenko','Tkachenko','Bondarenko','Sereda','Kovach','Romanenko',
             'Becker','Wagner','Hoffmann','Klein','Wolf','Schulz','Neumann','Schwarz','Zimmermann','Krüger'])[i],
      'client' || i || '@example.dev',
      '+49 30 ' || lpad(i::text, 8, '0'),
      (case when i <= 20 then 'UA' else 'DE' end),
      '1980-01-01'::date + (i * 100)
    ) returning id into v_client_id;
    client_ids[i] := v_client_id;
  end loop;

  -- ~24 bookings, 1 passenger each, distributed across trips.
  --
  -- All bookings are inserted as 'draft' first. The target status is
  -- then applied via UPDATE so the bookings_set_contract_number trigger
  -- (BEFORE UPDATE OF status) fires and allocates contract_number on
  -- transitions into 'confirmed'. paid_amount_eur is set consistently
  -- with the final status: paid → total, partially_paid → ~half, others → 0.
  --
  -- Variable names are v_* to avoid shadowing column names of the same
  -- name in WHERE / RETURNING clauses (#variable_conflict use_column
  -- already directs plpgsql to prefer columns, but explicit naming is
  -- still clearer for the next maintainer).
  declare
    target_status public.booking_status;
    final_paid    numeric(10,2);
    booking_total numeric(10,2) := 720;
  begin
    for i in 1..24 loop
      v_trip_id := trip_ids[1 + ((i - 1) % 8)];
      v_client_id := client_ids[1 + ((i - 1) % 30)];
      v_hotel_id := hotel_ids[1 + ((i - 1) % 10)];

      -- Pick lowest free seat on the trip.
      select ts.seat_number into free_seat
        from public.trip_seats ts
       where ts.trip_id = v_trip_id and ts.status = 'free'
       order by ts.seat_number
       limit 1;

      if free_seat is null then
        continue;
      end if;

      target_status := (array['draft','confirmed','partially_paid','paid','confirmed','paid'])[1 + ((i-1) % 6)]::public.booking_status;
      final_paid := case
                      when target_status = 'paid'           then booking_total
                      when target_status = 'partially_paid' then booking_total / 2
                      else 0
                    end;

      -- 1) INSERT as draft so the lifecycle trigger fires on the UPDATE.
      insert into public.bookings (tenant_id, client_id, trip_id, sold_by_manager_id,
                                   status, total_price_eur, paid_amount_eur, commission_eur)
      values (tid, v_client_id, v_trip_id,
              (array[owner_mid, mid_olena, mid_andreas, mid_petra])[1 + ((i-1) % 4)],
              'draft', booking_total, 0, 72)
      returning id into v_booking_id;

      -- 2) Transition to the target status. For partially_paid/paid we
      --    must first pass through 'confirmed' (the state machine forbids
      --    'draft' → 'partially_paid' or 'draft' → 'paid' directly).
      if target_status in ('partially_paid', 'paid') then
        update public.bookings set status = 'confirmed' where id = v_booking_id;
        if target_status = 'partially_paid' then
          update public.bookings
             set status = 'partially_paid', paid_amount_eur = final_paid
           where id = v_booking_id;
        else
          update public.bookings
             set status = 'paid', paid_amount_eur = final_paid
           where id = v_booking_id;
        end if;
      elsif target_status = 'confirmed' then
        update public.bookings set status = 'confirmed' where id = v_booking_id;
      end if;
      -- 'draft' stays as inserted; no UPDATE needed.

      -- One passenger occupying the free seat.
      insert into public.booking_passengers (
        tenant_id, booking_id, kind, first_name, last_name,
        seat_number, hotel_id, room_type, price_total_eur
      ) values (
        tid, v_booking_id, 'adult',
        (select first_name from public.clients where id = v_client_id),
        (select last_name  from public.clients where id = v_client_id),
        free_seat, v_hotel_id, 'double', booking_total
      );

      -- Mark seat sold.
      update public.trip_seats ts
         set status = 'sold', booking_id = v_booking_id
       where ts.trip_id = v_trip_id and ts.seat_number = free_seat;
    end loop;
  end;

  raise notice 'AnyTour dev seed complete: 1 tenant, 4 managers, 10 hotels, 8 trips, 30 clients, ~24 bookings';
end;
$seed$;
