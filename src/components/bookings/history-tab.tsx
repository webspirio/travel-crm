import type { TFunction } from "i18next"
import { format, formatDistanceToNow } from "date-fns"
import { de, uk } from "date-fns/locale"
import { useTranslation } from "react-i18next"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { auditFieldLabel } from "@/lib/audit-field-labels"
import {
  useBookingHistory,
  type BookingAuditRow,
} from "@/hooks/queries/use-booking-history"
import type { Locale } from "@/types"

import { FieldDiff } from "./field-diff"

interface HistoryTabProps {
  bookingId: string
  /**
   * Map of passenger UUID → "First Last" for the entity badge on
   * booking_passengers rows. Caller computes from booking.passengers.
   */
  passengerNamesById: Record<string, string>
}

/** First-letter initials, max 2, for the actor avatar. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

/** Pick the date-fns locale for relative time formatting. */
function dfLocale(locale: Locale) {
  return locale === "de" ? de : uk
}

/**
 * Booking-detail History tab — unified audit feed for the booking + its
 * passengers + its payments. Reads via `useBookingHistory` (T11), which
 * paginates server-side at 20 rows/page on a (created_at, id) tuple cursor.
 */
export function HistoryTab({ bookingId, passengerNamesById }: HistoryTabProps) {
  const { t, i18n } = useTranslation("booking")
  const { t: tc } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale
  const query = useBookingHistory(bookingId)

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  if (query.error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {query.error.message}
      </div>
    )
  }

  const rows = (query.data?.pages ?? []).flat()

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        {t("detail.history.empty")}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <HistoryRow
          key={row.id}
          row={row}
          passengerNamesById={passengerNamesById}
          t={t}
          tc={tc}
          locale={locale}
        />
      ))}

      {query.hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage
              ? t("detail.history.loadingMore")
              : t("detail.history.loadMore")}
          </Button>
        </div>
      )}

      {!query.hasNextPage && rows.length > 0 && (
        <p className="pt-2 text-center text-xs text-muted-foreground">
          {t("detail.history.endOfHistory")}
        </p>
      )}
    </div>
  )
}

interface HistoryRowProps {
  row: BookingAuditRow
  passengerNamesById: Record<string, string>
  t: TFunction<"booking">
  tc: TFunction
  locale: Locale
}

function HistoryRow({ row, passengerNamesById, t, tc, locale }: HistoryRowProps) {
  const ts = new Date(row.created_at)
  const relative = formatDistanceToNow(ts, { addSuffix: true, locale: dfLocale(locale) })
  const absolute = format(ts, "yyyy-MM-dd HH:mm:ss")

  const entityLabel =
    row.entity_table === "bookings"
      ? t("detail.history.entityBooking")
      : row.entity_table === "booking_passengers"
        ? t("detail.history.entityPassenger", {
            name: passengerNamesById[row.entity_id] ?? "—",
          })
        : t("detail.history.entityPayment")

  const actionLabel =
    row.action === "insert"
      ? t("detail.history.actionInsert")
      : row.action === "delete"
        ? t("detail.history.actionDelete")
        : t("detail.history.actionUpdate")

  // Compute the set of changed columns we want to surface.
  // - For insert: before is null/empty → emit every key in `after` that maps.
  // - For delete: after is null/empty → emit every key in `before` that maps.
  // - For update: union of keys, kept where the values differ deeply.
  const before = row.before ?? {}
  const after = row.after ?? {}
  const allKeys = Array.from(
    new Set([...Object.keys(before), ...Object.keys(after)]),
  )
  const changedKeys = allKeys.filter((k) => {
    if (!auditFieldLabel(row.entity_table, k)) return false
    if (row.action === "insert") return after[k] !== undefined && after[k] !== null
    if (row.action === "delete") return before[k] !== undefined && before[k] !== null
    // update — deep compare via JSON to handle jsonb (price_breakdown).
    return JSON.stringify(before[k]) !== JSON.stringify(after[k])
  })

  return (
    <div className="rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Avatar size="sm">
          <AvatarFallback>{initials(row.actor_name)}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">{row.actor_name}</span>
        <span className="text-sm text-muted-foreground">·</span>
        <span className="text-sm">{actionLabel}</span>
        <Badge variant="outline">{entityLabel}</Badge>
        <span className="ml-auto text-xs text-muted-foreground" title={absolute}>
          {relative}
        </span>
      </div>

      {row.reason && (
        <div className="mt-2">
          <Badge variant="secondary">{row.reason}</Badge>
        </div>
      )}

      {changedKeys.length > 0 && (
        <div className="mt-3 space-y-1 border-l-2 border-muted pl-3">
          {changedKeys.map((k) => (
            <FieldDiff
              key={k}
              table={row.entity_table}
              column={k}
              // For insert: show "before = nothing" by passing null; FieldDiff
              // will render an em-dash. For delete: same trick mirrored.
              before={row.action === "insert" ? null : before[k]}
              after={row.action === "delete" ? null : after[k]}
              t={t}
              tc={tc}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  )
}
