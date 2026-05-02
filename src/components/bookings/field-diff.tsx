import type { TFunction } from "i18next"
import type { ReactNode } from "react"

import { auditFieldLabel, type AuditEntityTable } from "@/lib/audit-field-labels"
import { formatCurrency, formatDate } from "@/lib/format"
import type { Locale } from "@/types"

interface Props {
  table: AuditEntityTable
  column: string
  before: unknown
  after: unknown
  /** Field-label translator (booking namespace). */
  t: TFunction<"booking">
  /** Common-namespace translator (for status/method/room/kind enums). */
  tc: TFunction
  locale: Locale
}

/** Date columns rendered with `formatDate`. */
const DATE_COLUMNS = new Set(["due_date", "birth_date", "received_at"])

/** EUR-currency columns. */
const EUR_COLUMNS = new Set([
  "total_price_eur",
  "paid_amount_eur",
  "commission_eur",
  "price_total_eur",
  "amount_eur",
])

/** Foreign-key columns rendered as a tiny short-uuid badge. */
const FK_COLUMNS = new Set([
  "client_id",
  "trip_id",
  "hotel_id",
  "sold_by_manager_id",
  "received_by_manager_id",
])

/**
 * Format a single audit field value to a human-readable React node, given the
 * column it came from.
 *
 * Coercions in priority order:
 *   1. null/undefined  → em-dash placeholder
 *   2. enum columns    → tc() lookup against canonical labels reused elsewhere
 *   3. dates           → formatDate(locale)
 *   4. EUR amounts     → formatCurrency(locale), 0-decimal
 *   5. seat_number     → raw integer
 *   6. FK uuids        → first 8 chars in a code badge (TODO: resolve to names)
 *   7. booleans        → tc("yes") / tc("no") with raw fallback
 *   8. anything else   → JSON.stringify (covers price_breakdown jsonb, etc.)
 */
function formatValue(
  column: string,
  value: unknown,
  tc: TFunction,
  locale: Locale,
): ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>
  }

  // Enum columns — reuse canonical labels already used elsewhere in the app.
  if (column === "status" && typeof value === "string") {
    return tc(`bookingStatus.${value}`)
  }
  if (column === "kind" && typeof value === "string") {
    // No global passengerKind.* namespace; reuse detail.passengers.<kind> from booking ns.
    // This component is rendered with `tc` from the default namespace, so fall back to
    // the raw enum value if the lookup misses (i18next returns the key when missing).
    // Callers who pass a `t("booking")` translator could resolve it; we keep it raw to
    // avoid coupling formatValue to a specific namespace.
    return String(value)
  }
  if (column === "room_type" && typeof value === "string") {
    return tc(`room.${value}`)
  }
  if (column === "method" && typeof value === "string") {
    // No global paymentMethod.* namespace yet; render the raw enum value.
    // TODO: add common.paymentMethod.{cash,bank_transfer,card} and tc() it here.
    return String(value)
  }

  // Date columns — accept both Date and ISO-string from jsonb.
  if (DATE_COLUMNS.has(column) && (typeof value === "string" || value instanceof Date)) {
    const d = value instanceof Date ? value : new Date(value)
    if (!Number.isNaN(d.getTime())) return formatDate(d, locale)
  }

  // EUR amounts.
  if (EUR_COLUMNS.has(column) && typeof value === "number") {
    return formatCurrency(value, locale)
  }

  // Seat number (or any plain integer that doesn't fit the buckets above).
  if (column === "seat_number" && typeof value === "number") {
    return `#${value}`
  }

  // Foreign keys — short-uuid badge. v1: not resolved to display names.
  // TODO: pass a uuid→name resolver so we can show "Client: Anna Schmidt" etc.
  if (FK_COLUMNS.has(column) && typeof value === "string") {
    return (
      <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
        {value.slice(0, 8)}
      </code>
    )
  }

  if (typeof value === "boolean") {
    return value ? tc("yes") : tc("no")
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value)
  }

  // Fallback — jsonb structures (price_breakdown), unknown shapes.
  return (
    <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
      {JSON.stringify(value)}
    </code>
  )
}

/**
 * Renders a single before→after field change as an inline row:
 *
 *   <Label>: <before, struck-through> → <after, normal>
 *
 * Returns null if the field is not in the curated allow-list (defensive — the
 * parent already filters with `auditFieldLabel` before invoking) or if the
 * before/after values are deeply equal.
 */
export function FieldDiff({ table, column, before, after, t, tc, locale }: Props) {
  const labelKey = auditFieldLabel(table, column)
  if (!labelKey) return null

  // Defensive: skip rendering when nothing actually changed (deep equality).
  if (JSON.stringify(before) === JSON.stringify(after)) return null

  const beforeNode = formatValue(column, before, tc, locale)
  const afterNode = formatValue(column, after, tc, locale)

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
      <span className="text-muted-foreground">{t(labelKey)}:</span>
      <span className="line-through opacity-60">{beforeNode}</span>
      <span className="text-muted-foreground">→</span>
      <span className="font-medium">{afterNode}</span>
    </div>
  )
}
