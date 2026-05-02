import { useMutation, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { bookingsKeys } from "@/hooks/queries/use-bookings"
import { useAuthStore } from "@/stores/auth-store"
import type { Database, Json } from "@/types/database"

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"]

export interface UpdateBookingPatch {
  notes?: string | null
  due_date?: string | null
  total_price_eur?: number
  operator_ref?: string | null
  invoice_number?: string | null
  commission_eur?: number
}

export interface UpdateBookingWithReasonInput {
  id: string
  patch: UpdateBookingPatch
  /** Optional human-readable reason. "" → DB trigger folds to NULL via nullif. */
  reason?: string
}

/**
 * Updates a booking via the `update_booking_with_reason` RPC (Phase 1, T2).
 *
 * The RPC writes the patch JSONB into the row, captures a snapshot to
 * `booking_history`, and (for sensitive columns) requires a non-empty reason
 * — the DB will RAISE if reason is missing for a sensitive field. This hook
 * passes whatever the caller hands in; UI gating is the caller's job.
 *
 * Auth guard mirrors `use-update-booking-status.ts` — throws `Error("no_session")`
 * when the auth store has no active tenant.
 *
 * On success invalidates:
 *   1. bookingsKeys.detail(id)         — booking detail page
 *   2. bookingsKeys.lists()            — global lists (dashboard, finance)
 *   3. bookingsKeys.byTrip(tripId)     — trip passenger table
 *   (TODO T11 — also invalidate bookingHistoryKeys.detail(id) once that
 *    factory exists. Not added yet.)
 */
export function useUpdateBookingWithReason() {
  const queryClient = useQueryClient()

  return useMutation<BookingRow, Error, UpdateBookingWithReasonInput>({
    mutationFn: async ({ id, patch, reason }) => {
      const { tenant } = useAuthStore.getState()
      if (!tenant?.id) throw new Error("no_session")

      // Scrub `undefined` keys + cast to the generated `Json` shape that
      // the RPC arg expects (PostgREST is fussy about extra props).
      const cleanPatch = JSON.parse(JSON.stringify(patch)) as Json

      const { data, error } = await supabase.rpc("update_booking_with_reason", {
        p_id: id,
        p_patch: cleanPatch,
        p_reason: reason ?? "",
      })
      if (error) throw error
      if (!data) throw new Error("rpc returned no row")
      return data as BookingRow
    },

    onSuccess: (row, { id }) => {
      void queryClient.invalidateQueries({ queryKey: bookingsKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: bookingsKeys.lists() })
      if (row.trip_id) {
        void queryClient.invalidateQueries({ queryKey: bookingsKeys.byTrip(row.trip_id) })
      }
    },
  })
}
