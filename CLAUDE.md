# AnyTour CRM — Working Notes for Claude

## Project identity

AnyTour CRM is a multi-tenant booking system for German bus tours to Italian coastal resorts, replacing a 14-sheet `Бронь.xlsx` workflow. Stack: **React 19 + Vite + TypeScript + Tailwind v4 + shadcn/ui + Supabase (Postgres / Auth / RLS / Realtime / Storage / Edge Functions)**. Multi-tenant **Flavor B**: single Supabase project, every entity carries `tenant_id`, RLS enforces isolation, hard cap of 4 tenants in this contract. Two languages: Ukrainian + German.

For full scope, pricing, and acceptance criteria see `PROPOSAL.md`. For build phases and tech inventory see `PLAN.md`. For sales narrative see `SALES.md`.

---

## Reference projects (`.reference/`)

The `.reference/` directory contains shallow clones of high-quality open-source projects we study for patterns. **It is gitignored and is never part of the build.** Treat it as read-only library material.

Cloning is automated: `.devcontainer/clone-references.sh` runs as Phase 4 of `post-create.sh` on every devcontainer build. The script is idempotent — existing folders are skipped. To refresh manually: `bash .devcontainer/clone-references.sh`. To pull the latest of one repo: `git -C .reference/<name> pull --depth=1`.

| Folder | Source | Why it's here |
|---|---|---|
| `atomic-crm/` | `marmelab/atomic-crm` | **Primary reference.** Same exact stack (React + Vite + shadcn + Supabase + react-hook-form + react-query). Study `/supabase/` migrations layout, auth flows, activity log, testing skeleton (Storybook + pgTap + Playwright). |
| `basejump/` | `usebasejump/basejump` | Multi-tenant SQL primitives — `accounts + account_user + has_role_on_account()`. We rename `accounts` → `tenants`, drop the Stripe layer, keep the membership/role-helper pattern. |
| `shadcn-admin/` | `satnaing/shadcn-admin` | UI polish reference — Cmd+K command palette, collapsible sidebar with persisted state, dark-mode wiring, empty/skeleton/error-boundary patterns. |
| `pdfme/` | `pdfme/pdfme` | PDF generation for boarding sheet + client contract. **Cyrillic-safe** via Noto Sans / Roboto fonts. WYSIWYG template designer + invoice-generator demo. Browser-side, no server. |
| `cal.com/` | `calcom/cal.com` (sparse) | Booking-conflict patterns — sparse-checkout of `packages/features/bookings/` only. Read for slot-hold TTL, race-condition handling, stale-hold expiration. Different stack (Next + Prisma) — read, don't port. |
| `supabase-nextjs-template/` | `Razikus/supabase-nextjs-template` | RLS + storage + i18n SaaS template. Next.js — port patterns only. |
| `next-shadcn-dashboard-starter/` | `Kiranism/next-shadcn-dashboard-starter` | Multi-tenant workspace patterns + polished shadcn dashboard. Uses Clerk (we don't); read auth patterns selectively. |
| `supabase-multi-tenancy/` | `dikshantrajput/supabase-multi-tenancy` | Minimal multi-tenant Supabase reference — small, easy to read end-to-end. |
| `react-spreadsheet-import/` | `UgnisSoftware/react-spreadsheet-import` | **Etap 2 — deferred.** Excel import column-mapping flow. Do not implement in production-MVP unless the scope is re-negotiated. |
| `bulletproof-react/` | `alan2207/bulletproof-react` | (Pre-existing.) General React architecture / project-structure conventions. |

---

## How to use the references

- **Read-only.** Never `npm install`, never edit, never copy files wholesale.
- **Borrow patterns, not pages.** RLS shapes, directory layouts, algorithms — yes. Components, copy-pasted views — no.
- **Domain shapes differ.** Atomic CRM is a sales CRM (contacts/companies/deals); Cal.com is scheduling; the Next templates are e-commerce/SaaS. Ours is **operational** (bus seats, hotel allotments, multi-leg pickup routes). Adapt, don't transplant.
- **Stacks differ.** Cal.com / dashboard starters use Next.js + Prisma + Clerk. We use Vite + Supabase. Don't drag in incompatible deps just because a reference uses them (specifically: Chakra UI from `react-spreadsheet-import`, Clerk from `next-shadcn-dashboard-starter`).

---

## Quick lookup — when implementing X, read Y first

| When you implement… | Read… |
|---|---|
| Multi-tenant schema + RLS policies | `.reference/basejump/` (SQL) + Makerkit RLS article (link below) |
| Supabase migrations / edge function layout | `.reference/atomic-crm/supabase/` |
| Auth flows (email + Google) | `.reference/atomic-crm/src/` (auth pages) |
| Sidebar, Cmd+K palette, theme toggle | `.reference/shadcn-admin/src/` |
| PDF templates (boarding sheet, contract) | `.reference/pdfme/` (template designer + invoice demo) |
| Booking slot conflicts, holds with TTL | `.reference/cal.com/packages/features/bookings/` |
| Realtime seat-map collisions | Supabase Realtime Presence docs (link below) + DB-level partial unique index |
| Activity / audit log | `.reference/atomic-crm/` (activity log feature) |
| Excel import (Etap 2 only) | `.reference/react-spreadsheet-import/` |

External anchor links:
- Makerkit RLS best practices: https://makerkit.dev/blog/tutorials/supabase-rls-best-practices
- Supabase Realtime Presence: https://supabase.com/docs/guides/realtime/presence

---

## Build context anchors

- **Pricing, scope, acceptance criteria, GDPR clauses** → `PROPOSAL.md`
- **Tech stack versions, phase-by-phase build plan** → `PLAN.md`
- **Sales narrative for client conversations** → `SALES.md`
- **Long-form planning documents** → `~/.claude/plans/` (current research deliverable: `i-want-you-to-ticklish-curry.md`)

---

## What NOT to do

- **Don't fork any reference whole.** Domain is too specific to ours.
- **Don't add Chakra UI** to satisfy `react-spreadsheet-import` — port the auto-mapping logic to a shadcn-skinned modal if/when Excel import comes back into scope.
- **Don't render PDFs server-side.** Supabase Edge Functions cannot run Puppeteer/Chromium (resource limits) and `pdfkit` hits Deno permission errors. Use `pdfme` client-side. Browserless.io is a paid escape hatch — only if a future template genuinely requires server-side rendering.
- **Don't ship Excel import in Etap 1.** Deferred to Etap 2 per current scope. Keep `react-spreadsheet-import` cloned for when it comes back.
- **Don't use `@react-pdf/renderer`.** Has open Cyrillic font-fallback issues. `pdfme` avoids them entirely.
- **Don't use `user_metadata` for authorization.** It's client-mutable. Use `app_metadata` or a database table.
- **Don't skip the `(select auth.uid())` wrapping in RLS policies.** Postgres caches the call once per query — significant perf win on tables with many rows.
