import { useMutation, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { bookingsKeys } from "@/hooks/queries/use-bookings"
import { paymentsKeys } from "@/hooks/queries/use-payments"
import { useAuthStore } from "@/stores/auth-store"
import type { Database, Json } from "@/types/database"

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"]

export interface UpdatePaymentPatch {
  notes?: string | null
  reference?: string | null
}

export interface UpdatePaymentWithReasonInput {
  id: string
  /** parent booking id — used solely for cache invalidation */
  bookingId: string
  patch: UpdatePaymentPatch
  reason?: string
}

/**
 * Updates a single payment via the `update_payment_with_reason` RPC
 * (Phase 1, T2). Only `notes` and `reference` are accepted patch keys today
 * — amount/method edits are blocked at the DB layer.
 *
 * On success invalidates:
 *   1. paymentsKeys.byBooking(bookingId) — payments table on detail page
 *   2. bookingsKeys.detail(bookingId)    — header totals (paid_amount safety)
 *   (TODO T11 — also invalidate bookingHistoryKeys.detail(bookingId).)
 */
export function useUpdatePaymentWithReason() {
  const queryClient = useQueryClient()

  return useMutation<PaymentRow, Error, UpdatePaymentWithReasonInput>({
    mutationFn: async ({ id, patch, reason }) => {
      const { tenant } = useAuthStore.getState()
      if (!tenant?.id) throw new Error("no_session")

      const cleanPatch = JSON.parse(JSON.stringify(patch)) as Json

      const { data, error } = await supabase.rpc("update_payment_with_reason", {
        p_id: id,
        p_patch: cleanPatch,
        p_reason: reason ?? "",
      })
      if (error) throw error
      if (!data) throw new Error("rpc returned no row")
      return data as PaymentRow
    },

    onSuccess: (_row, { bookingId }) => {
      void queryClient.invalidateQueries({ queryKey: paymentsKeys.byBooking(bookingId) })
      void queryClient.invalidateQueries({ queryKey: bookingsKeys.detail(bookingId) })
    },
  })
}
