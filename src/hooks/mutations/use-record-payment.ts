import { useMutation, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { paymentsKeys } from "@/hooks/queries/use-payments"
import { bookingsKeys } from "@/hooks/queries/use-bookings"
import { useAuthStore } from "@/stores/auth-store"
import type { Database } from "@/types/database"

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"]
type ManagerRow = Database["public"]["Tables"]["managers"]["Row"]
type PaymentMethod = Database["public"]["Enums"]["payment_method"]

export interface RecordPaymentInput {
  bookingId: string
  /** Signed value; negative for refund. */
  amount: number
  method: PaymentMethod
  /** When omitted the DB column default (now()) is used. */
  receivedAt?: Date
  reference?: string
  notes?: string
}

/**
 * Records a payment against a booking in two sequential writes:
 *
 * 1. INSERT into `payments`.
 * 2. SELECT all payment amounts for the booking and UPDATE
 *    `bookings.paid_amount_eur` with their recomputed sum.
 *
 * If step 2 fails after step 1, the payment row is recorded but the
 * booking total is stale. Acceptable for Etap 1 — the next query-cache
 * invalidation will surface the correct figure on reload.
 *
 * Auth is read inside mutationFn via useAuthStore.getState(); throws
 * "no_session" or "no_manager" on missing context.
 */
export function useRecordPayment() {
  const queryClient = useQueryClient()

  return useMutation<PaymentRow, Error, RecordPaymentInput>({
    mutationFn: async ({ bookingId, amount, method, receivedAt, reference, notes }) => {
      // ── Step 0: resolve auth identities ────────────────────────────────
      const { tenant, user } = useAuthStore.getState()
      if (!tenant?.id || !user?.id) throw new Error("no_session")

      const tenantId = tenant.id
      const userId = user.id

      // Resolve manager id: cache first, then fresh SELECT on miss.
      let managerId: string
      const cachedManager = queryClient.getQueryData<ManagerRow | null>([
        "managers",
        "me",
        userId,
      ])
      if (cachedManager) {
        managerId = cachedManager.id
      } else {
        const { data: managerRow, error: managerErr } = await supabase
          .from("managers")
          .select("id")
          .eq("user_id", userId)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle()
        if (managerErr) throw managerErr
        if (!managerRow) throw new Error("no_manager")
        managerId = managerRow.id
      }

      // ── Step 1: INSERT payment row ──────────────────────────────────────
      const insertPayload: Database["public"]["Tables"]["payments"]["Insert"] = {
        tenant_id: tenantId,
        booking_id: bookingId,
        amount_eur: amount,
        method,
        received_by_manager_id: managerId,
        ...(receivedAt ? { received_at: receivedAt.toISOString() } : {}),
        ...(reference ? { reference } : {}),
        ...(notes ? { notes } : {}),
      }

      const { data: paymentRow, error: insertErr } = await supabase
        .from("payments")
        .insert(insertPayload)
        .select()
        .single()

      if (insertErr) throw insertErr

      // ── Step 2: recompute and update paid_amount_eur ────────────────────
      const { data: allPayments, error: fetchErr } = await supabase
        .from("payments")
        .select("amount_eur")
        .eq("booking_id", bookingId)

      if (!fetchErr && allPayments) {
        const newPaidAmount = allPayments.reduce(
          (sum, row) => sum + Number(row.amount_eur),
          0,
        )
        // Intentionally not throwing on update failure (see JSDoc above).
        await supabase
          .from("bookings")
          .update({ paid_amount_eur: newPaidAmount })
          .eq("id", bookingId)
      }

      return paymentRow
    },

    onSuccess: (_paymentRow, { bookingId }) => {
      void queryClient.invalidateQueries({ queryKey: paymentsKeys.byBooking(bookingId) })
      void queryClient.invalidateQueries({ queryKey: bookingsKeys.all })
    },
  })
}
