-- Phase 1.5 — generic timestamp trigger function.
--
-- Attached per-table starting Phase 2 via:
--   create trigger <table>_touch_updated_at
--     before update on public.<table>
--     for each row execute function private.touch_updated_at();
--
-- Phase 1 doesn't attach it anywhere; the function exists so Phase 2's
-- domain-table migrations can reference it without a deferred dependency.

create or replace function private.touch_updated_at() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
