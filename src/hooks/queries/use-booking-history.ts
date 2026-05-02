import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"

/**
 * Booking audit history feed (T11).
 *
 * Reads via the `public.get_booking_audit` RPC, which unions audit_log rows
 * for the booking + its passengers + its payments and joins the actor
 * display_name from public.managers. Server-side cursor pagination on
 * `created_at` (exclusive `before` parameter, NULL on first page).
 *
 * Why infinite-query with a timestamp cursor (not a numeric offset):
 *   - audit_log writes are append-only and ordered by created_at desc, so a
 *     timestamp cursor stays correct under concurrent edits — new rows that
 *     land while the user paginates show up on the next refetch, never
 *     shift the existing pages.
 *   - Picking the OLDEST created_at in the last page as the next cursor
 *     keeps "load more" working with the strictly-less-than predicate the
 *     RPC enforces (`a.created_at < p_before`).
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
    string | null
  >({
    queryKey: bookingHistoryKeys.detail(bookingId ?? ""),
    enabled: !!bookingId,
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      if (!bookingId) return []
      const { data, error } = await supabase.rpc("get_booking_audit", {
        p_booking_id: bookingId,
        p_limit: PAGE_SIZE,
        // null on first page; oldest created_at in the previous page on subsequent pages.
        p_before: pageParam ?? undefined,
      })
      if (error) throw error
      return (data ?? []) as unknown as BookingAuditRow[]
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PAGE_SIZE) return undefined // exhausted
      // Oldest row in this page becomes the strict upper bound for the next page.
      return lastPage[lastPage.length - 1].created_at
    },
  })
}
