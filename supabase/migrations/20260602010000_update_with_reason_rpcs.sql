-- Phase 2.x — update_*_with_reason RPCs (booking, passenger, payment).
--
-- Three security-definer RPCs that the React layer calls whenever a manager
-- edits a booking, a passenger row, or a payment from the "view & edit
-- booking" surface. Each function takes (id, jsonb patch, reason) and
-- threads the reason through to the audit_log via the `audit.reason` GUC
-- contract established in 20260602000000_audit_log_reason_and_managers_select.sql.
--
-- The GUC contract:
--   We call pg_catalog.set_config('audit.reason', p_reason, true) before
--   the UPDATE. The third arg `true` means is_local=transaction-scoped — it
--   is THIS WAY ON PURPOSE and must never be flipped to false. False would
--   leak the reason into the connection's session state and contaminate the
--   next request that runs on the same pooled connection. The audit trigger
--   reads it back via current_setting('audit.reason', true) (missing_ok=true)
--   and folds empty-string to NULL via nullif so callers don't have to
--   RESET the GUC between calls within the same transaction.
--
-- Why per-table RPCs and not one generic primitive?
--   These functions are SECURITY DEFINER, so they run as `postgres`
--   (superuser) and would otherwise bypass every RLS policy AND every
--   column-level invariant we have. The whitelist below IS the security
--   boundary. A generic `update_table_with_reason(table, id, patch)` would
--   either need a runtime whitelist lookup (fragile, easy to forget) or
--   trust the caller (unacceptable). Three explicit functions, one explicit
--   set of allowed columns each — every column omitted is a column the UI
--   cannot touch via this surface.
--
-- Authorization: SECURITY DEFINER also bypasses RLS, so each function
-- re-checks `private.has_role_on_tenant(target_tenant_id)` manually after
-- looking up the row. Cross-tenant calls raise 42501 (insufficient_privilege).
-- Non-existent rows raise P0002 (no_data_found). Non-whitelisted columns
-- in the patch raise 22023 (invalid_parameter_value) — silent ignore would
-- hide client bugs, e.g. typos like `"statuss"` in a JSON payload.
--
-- Per-table whitelist rationale:
--   bookings:
--     allowed: notes, due_date, total_price_eur, operator_ref,
--              invoice_number, commission_eur
--     denied: status (state machine owns it), paid_amount_eur (computed
--             from payments by Phase 3 trigger), client_id / trip_id /
--             booking_number / contract_number / sold_by_manager_id /
--             tenant_id (structural; require dedicated flows / are
--             auto-allocated / are immutable).
--   booking_passengers:
--     allowed: first_name, last_name, birth_date, seat_number, hotel_id,
--              room_type, price_total_eur, price_breakdown, special_notes
--     denied: kind / booking_id / trip_id (immutable structural), client_id
--             (linkage flow), tenant_id, id, timestamps.
--   payments:
--     allowed: notes, reference
--     denied: amount_eur / received_at / method / received_by_manager_id —
--             a payment's amount or date should be voided + re-recorded,
--             not silently mutated; that preserves the audit shape an
--             accountant expects.

-- ============================================================
-- 1. update_booking_with_reason
-- ============================================================

create or replace function public.update_booking_with_reason(
  p_id      uuid,
  p_patch   jsonb,
  p_reason  text
) returns public.bookings
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_key       text;
  v_row       public.bookings;
begin
  -- 1. Look up tenant_id; raise no_data_found if the row is missing.
  select b.tenant_id into v_tenant_id
    from public.bookings b
   where b.id = p_id;

  if v_tenant_id is null then
    raise exception 'booking % not found', p_id using errcode = 'P0002';
  end if;

  -- 2. Authorisation re-check (SECURITY DEFINER bypasses RLS).
  if not (select private.has_role_on_tenant(v_tenant_id)) then
    raise exception 'access denied' using errcode = '42501';
  end if;

  -- 3. Whitelist enforcement. Raise on the first non-allowed key so the
  --    client surfaces the typo immediately rather than silently dropping it.
  -- Must match the SET list below.
  for v_key in select key from jsonb_each(p_patch) loop
    if v_key not in (
      'notes', 'due_date', 'total_price_eur',
      'operator_ref', 'invoice_number', 'commission_eur'
    ) then
      raise exception 'column % not allowed for update_booking_with_reason', v_key
        using errcode = '22023';
    end if;
  end loop;

  -- 4. Empty-patch short-circuit. If no whitelisted keys are present, skip
  --    the UPDATE entirely. Otherwise the BEFORE-UPDATE touch_updated_at
  --    trigger would bump updated_at and the AFTER-UPDATE audit trigger
  --    would write a phantom audit row whose only delta is updated_at.
  -- Must match the SET list below.
  if not (p_patch ?| array['notes','due_date','total_price_eur','operator_ref','invoice_number','commission_eur']) then
    select * into v_row from public.bookings where id = p_id;
    return v_row;
  end if;

  -- 5. Set the audit.reason GUC for the duration of this transaction.
  --    is_local=true is mandatory; see header comment.
  perform pg_catalog.set_config('audit.reason', p_reason, true);

  -- 6. Apply the patch. Each whitelisted column is preserved when absent
  --    from the patch and overwritten with the cast value when present.
  update public.bookings set
    notes           = case when p_patch ? 'notes'           then nullif(p_patch->>'notes', '')              else notes end,
    due_date        = case when p_patch ? 'due_date'        then nullif(p_patch->>'due_date', '')::date     else due_date end,
    total_price_eur = case when p_patch ? 'total_price_eur' then (p_patch->>'total_price_eur')::numeric     else total_price_eur end,
    operator_ref    = case when p_patch ? 'operator_ref'    then nullif(p_patch->>'operator_ref', '')       else operator_ref end,
    invoice_number  = case when p_patch ? 'invoice_number'  then nullif(p_patch->>'invoice_number', '')     else invoice_number end,
    commission_eur  = case when p_patch ? 'commission_eur'  then (p_patch->>'commission_eur')::numeric      else commission_eur end
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.update_booking_with_reason(uuid, jsonb, text) from public, anon;
grant  execute on function public.update_booking_with_reason(uuid, jsonb, text) to authenticated;

-- ============================================================
-- 2. update_passenger_with_reason
-- ============================================================

create or replace function public.update_passenger_with_reason(
  p_id      uuid,
  p_patch   jsonb,
  p_reason  text
) returns public.booking_passengers
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_key       text;
  v_row       public.booking_passengers;
begin
  select bp.tenant_id into v_tenant_id
    from public.booking_passengers bp
   where bp.id = p_id;

  if v_tenant_id is null then
    raise exception 'passenger % not found', p_id using errcode = 'P0002';
  end if;

  if not (select private.has_role_on_tenant(v_tenant_id)) then
    raise exception 'access denied' using errcode = '42501';
  end if;

  -- Must match the SET list below.
  for v_key in select key from jsonb_each(p_patch) loop
    if v_key not in (
      'first_name', 'last_name', 'birth_date', 'seat_number',
      'hotel_id', 'room_type', 'price_total_eur', 'price_breakdown',
      'special_notes'
    ) then
      raise exception 'column % not allowed for update_passenger_with_reason', v_key
        using errcode = '22023';
    end if;
  end loop;

  -- Empty-patch short-circuit (see update_booking_with_reason for rationale).
  -- Must match the SET list below.
  if not (p_patch ?| array['first_name','last_name','birth_date','seat_number','hotel_id','room_type','price_total_eur','price_breakdown','special_notes']) then
    select * into v_row from public.booking_passengers where id = p_id;
    return v_row;
  end if;

  perform pg_catalog.set_config('audit.reason', p_reason, true);

  -- price_breakdown stays JSONB (use -> not ->>); seat_number is smallint;
  -- hotel_id is uuid; room_type is the public.room_type enum.
  update public.booking_passengers set
    first_name      = case when p_patch ? 'first_name'      then p_patch->>'first_name'                                  else first_name end,
    last_name       = case when p_patch ? 'last_name'       then p_patch->>'last_name'                                   else last_name end,
    birth_date      = case when p_patch ? 'birth_date'      then nullif(p_patch->>'birth_date', '')::date                else birth_date end,
    seat_number     = case when p_patch ? 'seat_number'     then nullif(p_patch->>'seat_number', '')::smallint           else seat_number end,
    hotel_id        = case when p_patch ? 'hotel_id'        then nullif(p_patch->>'hotel_id', '')::uuid                  else hotel_id end,
    room_type       = case when p_patch ? 'room_type'       then nullif(p_patch->>'room_type', '')::public.room_type     else room_type end,
    price_total_eur = case when p_patch ? 'price_total_eur' then (p_patch->>'price_total_eur')::numeric                  else price_total_eur end,
    price_breakdown = case when p_patch ? 'price_breakdown' then coalesce(p_patch->'price_breakdown', '{}'::jsonb)       else price_breakdown end,
    special_notes   = case when p_patch ? 'special_notes'   then nullif(p_patch->>'special_notes', '')                   else special_notes end
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.update_passenger_with_reason(uuid, jsonb, text) from public, anon;
grant  execute on function public.update_passenger_with_reason(uuid, jsonb, text) to authenticated;

-- ============================================================
-- 3. update_payment_with_reason
-- ============================================================

create or replace function public.update_payment_with_reason(
  p_id      uuid,
  p_patch   jsonb,
  p_reason  text
) returns public.payments
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_key       text;
  v_row       public.payments;
begin
  select p.tenant_id into v_tenant_id
    from public.payments p
   where p.id = p_id;

  if v_tenant_id is null then
    raise exception 'payment % not found', p_id using errcode = 'P0002';
  end if;

  if not (select private.has_role_on_tenant(v_tenant_id)) then
    raise exception 'access denied' using errcode = '42501';
  end if;

  -- Must match the SET list below.
  for v_key in select key from jsonb_each(p_patch) loop
    if v_key not in ('notes', 'reference') then
      raise exception 'column % not allowed for update_payment_with_reason', v_key
        using errcode = '22023';
    end if;
  end loop;

  -- Empty-patch short-circuit (see update_booking_with_reason for rationale).
  -- Must match the SET list below.
  if not (p_patch ?| array['notes','reference']) then
    select * into v_row from public.payments where id = p_id;
    return v_row;
  end if;

  perform pg_catalog.set_config('audit.reason', p_reason, true);

  update public.payments set
    notes     = case when p_patch ? 'notes'     then nullif(p_patch->>'notes', '')              else notes end,
    reference = case when p_patch ? 'reference' then nullif(p_patch->>'reference', '')          else reference end
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.update_payment_with_reason(uuid, jsonb, text) from public, anon;
grant  execute on function public.update_payment_with_reason(uuid, jsonb, text) to authenticated;
