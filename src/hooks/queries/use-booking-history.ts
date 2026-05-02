import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"

/**
 * Booking audit history feed (T11).
 *
 * Reads via the `public.get_booking_audit` RPC, which unions audit_log rows
 * for the booking + its passengers + its payments and joins the actor
 * display_name from public.managers. Server-side cursor pagination on the
 * lexicographic tuple `(created_at, id)` (exclusive; NULL on first page).
 *
 * Why a tuple cursor (not just a timestamp):
 *   - audit_log rows written in the same transaction (e.g. create_booking
 *     + N booking_passengers in one INSERT) share created_at exactly,
 *     because the trigger captures `now()` once per transaction snapshot.
 *   - A strict `<` predicate on created_at alone drops the tie row when the
 *     boundary lands inside such a group. Pairing it with the bigint
 *     identity column `audit_log.id` (monotonic, unique) breaks the tie
 *     deterministically — Postgres evaluates `(ts, id) < (ts0, id0)`
 *     lexicographically.
 *   - getNextPageParam returns undefined when the last page came back
 *     short of PAGE_SIZE → useInfiniteQuery flips hasNextPage=false and
 *     the UI hides the "Load more" button.
 *
 * Cache invalidation: the T9 mutation hooks (update_booking_with_reason,
 * update_passenger_with_reason, update_payment_with_reason) invalidate
 * `bookingHistoryKeys.detail(bookingId)` after a successful mutation, so
 * a freshly written audit row shows up on the next render.
 */
export interface BookingAuditRow {
  id: number
  tenant_id: string
  actor_user_id: string | null
  /** display_name from public.managers, or '—' when the actor is unknown / pre-managers. */
  actor_name: string
  entity_table: "bookings" | "booking_passengers" | "payments"
  entity_id: string
  action: "insert" | "update" | "delete" | "truncate"
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  reason: string | null
  created_at: string
}

/** Lexicographic page cursor: (created_at, id). null on the first page. */
type Cursor = { ts: string; id: number } | null

export const bookingHistoryKeys = {
  all: ["booking-history"] as const,
  detail: (bookingId: string) => [...bookingHistoryKeys.all, "detail", bookingId] as const,
}

const PAGE_SIZE = 20

export function useBookingHistory(bookingId: string | undefined) {
  return useInfiniteQuery<
    BookingAuditRow[],
    Error,
    InfiniteData<BookingAuditRow[]>,
    readonly unknown[],
    Cursor
  >({
    queryKey: bookingHistoryKeys.detail(bookingId ?? ""),
    enabled: !!bookingId,
    initialPageParam: null as Cursor,
    queryFn: async ({ pageParam }) => {
      if (!bookingId) return []
      // Build args explicitly so the cursor keys are only present on
      // subsequent pages — avoids relying on supabase-js's undefined-skip
      // behaviour and keeps the wire payload tidy on the first page.
      const args: {
        p_booking_id: string
        p_limit: number
        p_before_ts?: string
        p_before_id?: number
      } = {
        p_booking_id: bookingId,
        p_limit: PAGE_SIZE,
      }
      if (pageParam) {
        args.p_before_ts = pageParam.ts
        args.p_before_id = pageParam.id
      }
      const { data, error } = await supabase.rpc("get_booking_audit", args)
      if (error) throw error
      return (data ?? []) as unknown as BookingAuditRow[]
    },
    getNextPageParam: (lastPage): Cursor | undefined => {
      if (lastPage.length < PAGE_SIZE) return undefined // exhausted
      // Oldest row in this page becomes the strict upper bound for the next
      // page — paired with its id so a created_at tie at the boundary does
      // not drop the matching row.
      const oldest = lastPage[lastPage.length - 1]
      return { ts: oldest.created_at, id: oldest.id }
    },
  })
}
