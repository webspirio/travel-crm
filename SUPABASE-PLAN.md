# AnyTour CRM — Supabase Implementation Plan (Etap 1)

> **Companion to:** `PROPOSAL.md` (commercial scope, acceptance criteria) · `PLAN.md` (frontend MVP, already shipped as live demo) · `CLAUDE.md` (reference projects, conventions).
>
> **Goal:** turn the existing frontend demo into a working production system — real Postgres, multi-tenant via RLS, realtime, auth, exports, audit log.
>
> **Out of scope (Etap 2 — explicitly deferred):** Excel import (`Бронь.xlsx` parsing), Stripe billing, self-serve tenant signup, public client cabinet, Viber/Telegram bots, OCR.

---

## Context

The frontend MVP (Phases 0–5 of `PLAN.md`) is complete: 6 screens, mock data, i18n (uk/de), seat-map, booking wizard, deployed to GitHub Pages. This plan replaces the mock layer with **Supabase** (Postgres + Auth + RLS + Realtime + Storage + Edge Functions) and adds the operational backbone: roles, audit log, exports, PDF, email.

**Multi-tenancy model: Flavor B.** Single Supabase project, every domain table carries `tenant_id`, RLS enforces isolation. Manual onboarding by the dev team. Hard cap: **4 tenants** (incl. AnyTour itself) within this contract. More than 4 = separate commercial product (Etap 2 SaaS).

Timeline: **5 weeks**, mapped 1:1 to `PROPOSAL.md` §4.

---

## Tooling & conventions

| Item | Choice | Notes |
|---|---|---|
| Supabase CLI | latest stable | `npm i -g supabase` or use the `supabase` Docker image |
| Local dev | `supabase start` (Docker) | Spins up Postgres + GoTrue + PostgREST + Realtime + Storage on localhost |
| Migrations | `supabase migration new <name>` | SQL-first, version-controlled in `/supabase/migrations/` |
| Schema diffing | `supabase db diff` | Generate migration from local schema changes |
| Type generation | `supabase gen types typescript` | Output: `src/types/database.ts` (committed) |
| Testing | **pgTap** | RLS policy tests in `/supabase/tests/` |
| Production region | **eu-central-1 (Frankfurt)** | GDPR §9.2 commitment |
| Plan tier | **Supabase Pro** (€25/mo per `PROPOSAL.md` §5.2) | Required for daily backups + 8 GB storage |

**Directory layout (mirroring `marmelab/atomic-crm`'s `/supabase`):**
```
supabase/
├── config.toml              # local dev config
├── migrations/              # numbered SQL files, immutable once committed
│   └── YYYYMMDDHHMMSS_*.sql
├── seed.sql                 # local dev seed only — never run in prod
├── tests/                   # pgTap tests
│   ├── rls_tenant_isolation.sql
│   ├── rls_role_permissions.sql
│   └── helpers/
└── functions/               # edge functions (Deno)
    ├── send-email/
    ├── generate-booking-number/
    └── _shared/
```

**Reference cheat sheet** (read these before starting each phase):
| Phase | Read first |
|---|---|
| Schema + RLS | `.reference/basejump/supabase/migrations/` (rename `accounts` → `tenants`) |
| Migration layout | `.reference/atomic-crm/supabase/` |
| Auth flows (email + Google) | `.reference/atomic-crm/src/` (auth pages) |
| Realtime presence | https://supabase.com/docs/guides/realtime/presence |
| RLS performance | https://makerkit.dev/blog/tutorials/supabase-rls-best-practices |

---

## Phase 1 — Multi-tenant foundation (Week 1)

**Goal:** working auth, tenant model, RLS skeleton. Empty domain tables. No app screens migrated yet.

### 1.1 Schema — tenants, membership, roles

**File:** `supabase/migrations/20260501000000_tenants.sql`

Adapted from Basejump's `accounts/account_user/has_role_on_account` pattern, simplified (no Stripe, no personal accounts).

```sql
-- Tenants: one row per partner company (incl. AnyTour itself)
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                     -- url-safe identifier
  name text not null,                            -- display name
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Tenant membership + role
create type public.tenant_role as enum ('owner', 'manager', 'agent');

create table public.tenant_users (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.tenant_role not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index tenant_users_user_id_idx on public.tenant_users(user_id);
```

### 1.2 Helper functions (security definer, in `private` schema)

Per Makerkit: complex permission checks should be `security definer` functions in a non-API-exposed schema.

```sql
create schema if not exists private;

create or replace function private.has_role_on_tenant(
  _tenant_id uuid,
  _roles public.tenant_role[] default array['owner','manager','agent']::public.tenant_role[]
) returns boolean
language sql security definer stable
set search_path = ''
as $$
  select exists (
    select 1 from public.tenant_users
    where tenant_id = _tenant_id
      and user_id = (select auth.uid())
      and role = any(_roles)
  );
$$;
```

**Critical patterns (Makerkit):**
- `(select auth.uid())` — caches the call once per query.
- `set search_path = ''` — explicit schema references prevent injection via search_path.
- `security definer` + `stable` — caller-context, cached within a query.

### 1.3 RLS on tenant tables

```sql
alter table public.tenants enable row level security;
alter table public.tenant_users enable row level security;

-- Tenants: members can read their tenant
create policy "members read own tenant"
  on public.tenants for select to authenticated
  using (private.has_role_on_tenant(id));

-- tenant_users: members read their tenant's membership
create policy "members read own tenant's users"
  on public.tenant_users for select to authenticated
  using (private.has_role_on_tenant(tenant_id));

-- Owner-only mutation policies (added in 1.4 once owner role is bootstrapped)
```

### 1.4 Bootstrapping the first tenant

Manual via SQL (per `PROPOSAL.md` §2.4 — no self-serve in Etap 1):

```sql
-- After creating auth user (via dashboard or seed), run:
insert into public.tenants (slug, name) values ('anytour', 'AnyTour');
insert into public.tenant_users (tenant_id, user_id, role)
  values ('<anytour-tenant-id>', '<owner-user-id>', 'owner');
```

A small admin script in `scripts/provision-tenant.ts` (run via `tsx`) wraps this for repeat use when onboarding the next 3 partners.

### 1.5 Auth setup

- **Email + password** (primary).
- **Google OAuth** (secondary — for managers' convenience).
- Disable signups: `supabase/config.toml` → `[auth] enable_signup = false`. New users created **only** via owner invitation flow (Etap 2 will turn this on; for now, dev-team-managed via dashboard).
- Email templates: customized in Supabase dashboard (uk + de).
- Session JWT contains `sub` (user_id). Tenant context resolved per-query via `tenant_users` lookup — **NOT** via JWT custom claim (avoids stale-claim issues when role changes).

### 1.6 RLS test skeleton (pgTap)

**File:** `supabase/tests/rls_tenant_isolation.sql`

```sql
begin;
select plan(4);

-- Setup: 2 tenants, 2 users, cross-test
-- (helpers in supabase/tests/helpers/)

select impersonate_user('manager-tenant-a@example.com');
select results_eq(
  'select count(*) from public.tenants',
  $$values (1::bigint)$$,
  'manager from tenant A sees only tenant A'
);

-- ... etc

select * from finish();
rollback;
```

Run via: `supabase test db`.

### Phase 1 deliverables

- [ ] Migration `20260501000000_tenants.sql` applied locally.
- [ ] `private.has_role_on_tenant()` works.
- [ ] RLS enabled on `tenants` + `tenant_users`.
- [ ] One tenant + one owner user provisioned manually.
- [ ] First pgTap test passing (cross-tenant SELECT returns 0 rows).
- [ ] Auth working in app (login form already exists from Phase 1 frontend).

---

## Phase 2 — Domain schema + frontend migration (Week 2)

**Goal:** every screen reads/writes Supabase. Mock data layer (`src/data/`) is removed.

### 2.1 Domain tables (one migration per logical group)

| Migration | Tables | Notes |
|---|---|---|
| `20260508000000_managers.sql` | `managers` | 1:1 with `auth.users`, scoped by `tenant_id` |
| `20260508010000_clients.sql` | `clients` | tenant-scoped, optional `passport_*` fields |
| `20260508020000_routes.sql` | `routes`, `pickup_points` | route = origin→destination + ordered points; GPS coords |
| `20260508030000_hotels.sql` | `hotels`, `rooms`, `room_types` | star rating, photos array |
| `20260508040000_trips.sql` | `trips` | bus type, departure date, capacity, status enum |
| `20260508050000_seats.sql` | `seat_layouts`, `trip_seats` | 55-seat / 79-seat templates; `trip_seats` rows are per-trip materializations |
| `20260508060000_hotel_blocks.sql` | `hotel_blocks` | matrix `(trip_id, hotel_id, room_type, qty)` |
| `20260508070000_bookings.sql` | `bookings`, `booking_passengers`, `booking_seats`, `booking_hotel_assignments` | core domain |
| `20260508080000_pricing.sql` | `pricing_rules` | adult/child base, +30€ first-3-rows, transfer-only flag |
| `20260508090000_commissions.sql` | `commission_rules`, `commission_ledger` | per-manager %, per-trip overrides, accrual rows |
| `20260508100000_payments.sql` | `payments` | tied to bookings, status enum |
| `20260508110000_audit.sql` | `audit_log` | append-only, `action`, `actor_id`, `entity_*`, `before/after` JSONB |

**Universal table conventions:**
- Every domain table has `tenant_id uuid not null references tenants(id)` indexed.
- Every table has `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`.
- `updated_at` maintained by a generic `private.touch_updated_at()` trigger (one trigger function, attached per table).
- Soft-delete via `deleted_at timestamptz` only where business rules require recoverable deletion (clients, bookings) — most tables hard-delete.

### 2.2 RLS policies — one pattern, applied to every domain table

```sql
alter table public.<entity> enable row level security;

create policy "tenant members read"
  on public.<entity> for select to authenticated
  using (private.has_role_on_tenant(tenant_id));

create policy "tenant members write"
  on public.<entity> for insert to authenticated
  with check (private.has_role_on_tenant(tenant_id));

create policy "tenant members update"
  on public.<entity> for update to authenticated
  using (private.has_role_on_tenant(tenant_id))
  with check (private.has_role_on_tenant(tenant_id));

create policy "owner-only delete"
  on public.<entity> for delete to authenticated
  using (private.has_role_on_tenant(tenant_id, array['owner']::public.tenant_role[]));
```

**Per-entity overrides (Manager doesn't see other managers' clients/bookings):**
```sql
create policy "manager scope"
  on public.bookings for select to authenticated
  using (
    private.has_role_on_tenant(tenant_id, array['owner']::public.tenant_role[])
    OR
    -- managers/agents see only their own bookings
    manager_id = (select id from public.managers where user_id = (select auth.uid()))
  );
```

Per Makerkit: btree-index every column an RLS policy filters on (`tenant_id`, `manager_id`, `user_id`, etc.).

### 2.3 Type generation

```bash
supabase gen types typescript --local > src/types/database.ts
```

Add to `package.json`:
```json
"scripts": {
  "db:types": "supabase gen types typescript --local > src/types/database.ts",
  "db:reset": "supabase db reset",
  "db:test": "supabase test db"
}
```

### 2.4 Supabase client + tenant context

**File:** `src/lib/supabase.ts`
```typescript
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

export const supabase = createBrowserClient<Database>(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);
```

**File:** `src/stores/auth-store.ts` (zustand) — holds `{ user, tenant, role }`. `tenant` resolved on login by querying `tenant_users` for the user.

**File:** `src/hooks/use-tenant.ts` — `() => useAuthStore(s => s.tenant)`. Throws if called outside an authenticated context.

### 2.5 Migrate frontend pages from mock to Supabase

For each page (`dashboard`, `trips/list`, `trips/detail`, `clients/list`, `bookings/new`):
1. Replace `import { trips } from '@/data'` with a `@tanstack/react-query` query against Supabase.
2. Add loading/error states (frontend already has Skeleton components).
3. Pagination via `range(from, to)`.
4. Remove the now-unused `src/data/` module.

**Add:** `@tanstack/react-query` + `@supabase/ssr` to `package.json`.

### Phase 2 deliverables

- [ ] All 12 domain tables migrated + RLS enabled.
- [ ] `database.ts` types generated and committed.
- [ ] All 6 frontend screens read live data.
- [ ] `src/data/` deleted.
- [ ] pgTap tests cover: cross-tenant isolation on every domain table, manager-scope on bookings.

---

## Phase 3 — Business rules + realtime (Week 3)

**Goal:** booking wizard works end-to-end with race-safe seat selection. Pricing, commissions, route logistics in place.

### 3.1 Seat-map race safety (highest-priority correctness)

**Two-layer guard** (per research deliverable):

**Layer 1 — DB unique constraint (correctness, unconditional):**
```sql
create unique index trip_seats_sold_unique
  on public.trip_seats (trip_id, seat_number)
  where status = 'sold';
```

**Layer 2 — Realtime presence (UX, advisory):**
- Each manager opens trip detail → joins channel `seat-map:{trip_id}`.
- Presence broadcasts `{ user_id, seat_number, action: 'editing' | 'reserving' }`.
- UI shows other manager's lock as a non-blocking overlay.
- Stale presence clears automatically on disconnect (CRDT-based).

**File:** `src/hooks/use-seat-presence.ts` — wraps `supabase.channel(...).on('presence', ...)`.

**Critical:** never block clicks based on presence alone. The DB constraint is the only source of truth.

### 3.2 Soft-hold pattern (from Cal.com)

To prevent the UX of "I clicked the seat and got an error": when a manager *starts* booking a seat:
1. Insert a `trip_seats` row with `status = 'reserved'` and `reserved_until = now() + interval '15 minutes'`.
2. The DB unique-sold-only index doesn't block reservations (status != 'sold'), but a **separate** policy CHECK rejects double-reservation:
   ```sql
   alter table public.trip_seats add constraint no_double_reserved
     exclude using gist (
       trip_id with =, seat_number with =
     ) where (status in ('reserved','sold') and (status = 'sold' or reserved_until > now()));
   ```
3. Cron job (Supabase scheduled function, every 1 min) sweeps expired reservations:
   ```sql
   update public.trip_seats
     set status = 'free', reserved_until = null
     where status = 'reserved' and reserved_until <= now();
   ```

### 3.3 Booking number generator

**File:** `supabase/functions/generate-booking-number/index.ts`

Format: `RE` + 2-digit year + 3-digit per-tenant counter. E.g. `RE26001`, `RE26002`.

```typescript
// Pseudo:
const { data } = await sb.from('bookings')
  .select('booking_number')
  .eq('tenant_id', tenantId)
  .like('booking_number', `RE${yy}%`)
  .order('booking_number', { ascending: false })
  .limit(1);
const next = (parseInt(data?.[0]?.booking_number.slice(4) ?? '0') + 1).toString().padStart(3, '0');
return `RE${yy}${next}`;
```

**Race safety:** wrap in a Postgres advisory lock per `(tenant_id, year)` to serialize concurrent generation:
```sql
select pg_advisory_xact_lock(hashtextextended(tenant_id::text || yy, 0));
```

### 3.4 Pricing engine

Server-side validation only. Client computes for UX, server re-computes on insert and rejects mismatches.

**File:** `supabase/migrations/.../pricing_function.sql`
```sql
create or replace function private.compute_booking_price(
  _trip_id uuid,
  _passengers jsonb,        -- [{ kind: 'adult'|'child', seat: int }, ...]
  _hotel_assignment jsonb   -- { hotel_id, room_type, nights }
) returns numeric
language plpgsql security definer stable
set search_path = ''
as $$
  -- ... apply pricing_rules: adult/child base, +30 for seats 1-12, transfer-only override
$$;
```

Trigger on `bookings` insert: `total_price` computed by function, fail with explanatory error if client-supplied total disagrees.

### 3.5 Commission accrual

On booking status change to `confirmed`:
- Trigger inserts `commission_ledger` rows per `commission_rules` (per-manager %, per-trip override).
- Owner runs "до виплати цього місяця" report = sum over `commission_ledger` for the current month, filtered by manager.

### 3.6 Hotel allotment guard

Each `hotel_blocks` row holds `(trip_id, hotel_id, room_type, qty_total, qty_used)`.
On booking insert:
```sql
update public.hotel_blocks
  set qty_used = qty_used + 1
  where trip_id = ? and hotel_id = ? and room_type = ?
    and qty_used < qty_total
  returning *;
-- If 0 rows returned → throw 'allotment exhausted'
```

UX alert when `qty_total - qty_used <= 1` (the «лишилось 1 DBL на 17.07» behavior from §2.2).

### Phase 3 deliverables

- [ ] DB unique-sold-seat index in place; double-sell test fails as expected.
- [ ] Booking wizard → seat → reserved-with-TTL → confirmed → sold flow works.
- [ ] Cron job sweeping expired reservations runs every minute.
- [ ] Booking number generator never collides under 10-concurrent-write load test.
- [ ] Server-side price validation rejects tampered totals.
- [ ] Commission rows generated on confirmation.
- [ ] Hotel allotment hard-rejects oversell.

---

## Phase 4 — Documents, integrations, audit (Week 4)

**Goal:** PDFs, emails, file attachments, audit log, Excel exports. (No Excel import — deferred to Etap 2.)

### 4.1 PDF generation (`pdfme`, browser-side)

**Templates (uk/de):**
- `src/pdf/templates/boarding-sheet.json` — driver's seating manifest, Cyrillic-safe (Noto Sans).
- `src/pdf/templates/contract.json` — client contract.

**File:** `src/pdf/generate.ts`
```typescript
import { generate } from '@pdfme/generator';
import { boardingSheetTemplate } from './templates/boarding-sheet';

export async function generateBoardingSheet(trip: Trip, lang: 'uk' | 'de') {
  const inputs = mapTripToBoardingSheetInputs(trip, lang);
  return generate({ template: boardingSheetTemplate, inputs });
}
```

Triggered by a button on Trip Detail → boarding sheet (driver) and Booking Detail → contract.

**Why client-side, not Edge Function:** Supabase Edge Functions cannot run Puppeteer/Chromium. `pdfme` runs entirely in the browser. See `CLAUDE.md` for the full reasoning.

### 4.2 Transactional email (Resend via Edge Function)

**File:** `supabase/functions/send-email/index.ts`
- Triggered from frontend with `{ kind, recipient_email, payload, lang }`.
- Renders template (`react-email` or string templates) in uk/de.
- Sends via Resend API.
- Logs to `email_log` table (entity, recipient, kind, sent_at, error).

**Email kinds (Etap 1):**
- `booking_confirmation`
- `payment_reminder`
- `departure_reminder` (T-7 days)

Trigger: scheduled Postgres function (`pg_cron`) for `departure_reminder` (runs daily, queues emails for trips departing in exactly 7 days).

### 4.3 Storage (passport scans + generated PDFs)

**Buckets:**
- `passport-scans` — private. RLS: only members of the booking's tenant can read; only owners can delete.
- `generated-pdfs` — private, regenerable; cache-only.

**Path convention:** `{tenant_slug}/{entity_type}/{entity_id}/{filename}`. Tenant slug in path for human-readable storage browsing.

**Storage RLS** (Supabase storage.objects has its own RLS):
```sql
create policy "tenant members read passport-scans"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'passport-scans'
    and private.has_role_on_tenant_by_slug(split_part(name, '/', 1))
  );
```

### 4.4 Audit log

**Pattern:** generic trigger function attached to every audited table.

```sql
create or replace function private.audit_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (
    tenant_id, actor_id, entity_table, entity_id, action, before, after, created_at
  ) values (
    coalesce(NEW.tenant_id, OLD.tenant_id),
    auth.uid(),
    TG_TABLE_NAME,
    coalesce(NEW.id, OLD.id),
    TG_OP,
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) end,
    case when TG_OP in ('INSERT','UPDATE') then to_jsonb(NEW) end,
    now()
  );
  return coalesce(NEW, OLD);
end; $$;
```

Attach to: `bookings`, `clients`, `payments`, `commission_ledger`, `tenant_users`. Skip for high-volume read-only tables.

**RLS:** owners read their tenant's audit log only. Managers/agents cannot read audit at all (per `PROPOSAL.md` §2.3).

### 4.5 Excel exports (SheetJS)

**File:** `src/excel/export.ts`
- Passenger list per trip → `passengers_{trip_slug}.xlsx`.
- Hotel allotment matrix → `allotments_{tenant_slug}_{month}.xlsx`.
- Monthly revenue report (owner only).

Browser-side via SheetJS. No server roundtrip needed.

### Phase 4 deliverables

- [ ] Boarding sheet + contract PDFs render correctly in uk + de.
- [ ] Email sending works for all 3 kinds; cron triggers T-7 reminders.
- [ ] Passport scan upload + retrieval respects tenant isolation.
- [ ] Audit log entries created on every mutation of audited tables.
- [ ] All 3 Excel exports work end-to-end.
- [ ] Storage RLS pgTap tests pass (cross-tenant cannot read each other's scans).

---

## Phase 5 — Hardening, deploy, training (Week 5)

**Goal:** production-grade isolation testing, prod deployment, manager onboarding.

### 5.1 Cross-tenant isolation audit

Per `PROPOSAL.md` §9.3 acceptance criterion 4. Before tenant 2 onboards:
- pgTap suite: every domain table tested for cross-tenant SELECT/INSERT/UPDATE/DELETE rejection.
- Manual exploration: log in as Tenant A manager, try to access Tenant B's data via direct URL manipulation (`/trips/{tenant-b-trip-id}`) — must 404 or return empty.
- API impersonation test (curl with stolen JWT) — RLS rejects.

**Recommended (per `PROPOSAL.md` §8):** independent third-party security audit before connecting first partner. €500–1,000 separate engagement. Not blocking for go-live.

### 5.2 Production deploy

- Create Supabase project in **eu-central-1 (Frankfurt)**, Pro tier.
- Apply all migrations: `supabase db push --linked`.
- Configure Auth: redirect URLs, email templates (uk + de), Google OAuth credentials.
- Configure Storage buckets + RLS.
- Deploy Edge Functions: `supabase functions deploy send-email`, etc.
- Set up `pg_cron` schedules.
- Set up daily backups (Pro tier default).
- Connect Sentry (DSN as `VITE_SENTRY_DSN`, no PII per `PROPOSAL.md` §9.2).
- Verify Resend domain (DNS records).
- Configure custom domain + Cloudflare.

### 5.3 Onboarding the first tenant

- Provision `anytour` tenant via `scripts/provision-tenant.ts`.
- Create owner user (Vlad).
- Create 4 manager users with email invites.
- (Excel import of historical bookings — **deferred to Etap 2**; for go-live, AnyTour starts fresh from `RE26001`.)
- Manager training session (`PROPOSAL.md` §7.1): 30-min video walkthrough recorded; live Q&A session.

### 5.4 Acceptance protocol sign-off

Per `PROPOSAL.md` §9.3:
1. Concurrent access test with 3 managers — recorded.
2. Boarding PDF + contract PDF render on real data.
3. Tenant 2 (test partner) provisioned; cross-tenant isolation confirmed.
4. Acceptance Protocol signed → triggers final 25% payment.

### Phase 5 deliverables

- [ ] All RLS isolation tests pass.
- [ ] Prod environment up at custom domain.
- [ ] Sentry receiving events, no PII.
- [ ] Backups verified by restoring to a staging project.
- [ ] AnyTour managers trained.
- [ ] Acceptance protocol signed.

---

## Critical files to be created (planned)

| File | Purpose |
|---|---|
| `supabase/config.toml` | Local dev, auth providers, signup-disabled |
| `supabase/migrations/2026050100*` | Tenant + auth foundation |
| `supabase/migrations/2026050800*` | Domain schema (12 files) |
| `supabase/migrations/2026051500*` | Realtime helpers, soft-hold, generators |
| `supabase/migrations/2026052200*` | Audit triggers, email_log, scheduled jobs |
| `supabase/tests/rls_tenant_isolation.sql` | Cross-tenant denial tests |
| `supabase/tests/rls_role_permissions.sql` | Owner/manager/agent scope tests |
| `supabase/functions/send-email/` | Resend integration |
| `supabase/functions/generate-booking-number/` | Per-tenant sequence |
| `supabase/functions/_shared/` | Shared Deno utils |
| `src/lib/supabase.ts` | Browser client |
| `src/stores/auth-store.ts` | { user, tenant, role } |
| `src/hooks/use-tenant.ts` | Tenant context hook |
| `src/hooks/use-seat-presence.ts` | Realtime presence wrapper |
| `src/types/database.ts` | Auto-generated types (committed) |
| `src/pdf/templates/boarding-sheet.json` | pdfme template (uk + de) |
| `src/pdf/templates/contract.json` | pdfme template (uk + de) |
| `src/pdf/generate.ts` | Generation entry points |
| `src/excel/export.ts` | SheetJS exports |
| `scripts/provision-tenant.ts` | Manual tenant onboarding helper |

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| RLS perf on high-row tables (bookings, audit_log) | Apply Makerkit's `(select auth.uid())` caching pattern + index every policy column from day 1. Run `EXPLAIN ANALYZE` on the 5 most-hit queries by week 3. |
| Race condition on seat sell | DB partial unique index is unconditional; Realtime presence is advisory only. Tested under 10-concurrent load before go-live. |
| Booking number collision | Postgres advisory lock per `(tenant_id, year)`. Tested under 10-concurrent load. |
| Soft-hold expiry stranding seats | `pg_cron` job every 1 min sweeps expired holds. Idempotent. |
| Email deliverability (Resend, German recipients) | DNS records (DKIM, SPF, DMARC) verified before tenant 1. `email_log` shows failures; manual retry button in admin UI. |
| GDPR data residency | Supabase Pro pinned to eu-central-1 (Frankfurt). No third-party SaaS in the email pipeline outside EU (Resend has EU regions). |
| Audit log table size growth | Daily partition by `created_at` if volume warrants (likely Etap 2). For Etap 1, single table + monthly archive-to-storage cron is sufficient. |
| Cross-tenant data leak through realtime channels | Channel names include `tenant_id`; channel subscription RLS via Supabase Realtime authorization (released 2024). Tested in Phase 5. |

---

## Verification — end-to-end

Per `PROPOSAL.md` §9.3, Etap 1 is accepted when:

1. **Concurrent access works** — 3 managers create bookings simultaneously, no conflicts, no double-sells.
2. **Exports + email work on real data** — boarding PDF, contract PDF, confirmation email all generate from a live booking.
3. **Multi-tenant isolation tested** — Tenant 2's data invisible to Tenant 1's manager, and vice versa, across all entities.
4. **Acceptance Protocol signed.**

Plus engineering quality gates:
- All pgTap tests green (`supabase test db`).
- Frontend e2e tests green (Playwright).
- TypeScript build passes (`npm run build`).
- No `any` types in `src/types/database.ts` (it's fully generated).
- Sentry shows zero errors during a 30-min smoke test session.

---

## Summary in one paragraph

Five phases mapped 1:1 to the 5-week proposal. Phase 1 = tenant + auth + RLS foundation (Basejump-derived, Makerkit-hardened). Phase 2 = 12 domain tables + RLS + frontend migration off mock data. Phase 3 = race-safe seat-map (DB partial unique index + Realtime Presence + soft-hold with TTL), pricing engine, commission accrual, hotel allotment guards, booking-number sequence. Phase 4 = pdfme PDFs (uk/de), Resend email via Edge Function, passport-scan storage with tenant-scoped paths, generic audit-trigger pattern, SheetJS exports. Phase 5 = cross-tenant isolation audit, prod deploy in Frankfurt, onboarding training, acceptance protocol. **Excel import (Бронь.xlsx parsing) is explicitly deferred to Etap 2** — re-import is no longer a Phase 4 task.
