import { useQuery } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database"

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"]

export interface Payment {
  id: string
  bookingId: string
  amountEur: number
  method: Database["public"]["Enums"]["payment_method"]
  receivedAt: Date
  receivedByManagerId: string | null
  reference: string | null
  notes: string | null
  createdAt: Date
}

function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    bookingId: row.booking_id,
    amountEur: Number(row.amount_eur),
    method: row.method,
    receivedAt: new Date(row.received_at),
    receivedByManagerId: row.received_by_manager_id,
    reference: row.reference,
    notes: row.notes,
    createdAt: new Date(row.created_at),
  }
}

export const paymentsKeys = {
  all: ["payments"] as const,
  byBooking: (bookingId: string) => [...paymentsKeys.all, "by-booking", bookingId] as const,
}

export function usePaymentsByBooking(bookingId: string | undefined) {
  return useQuery({
    queryKey: paymentsKeys.byBooking(bookingId ?? ""),
    queryFn: async (): Promise<Payment[]> => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("booking_id", bookingId!)
        .order("received_at", { ascending: false })
      if (error) throw error
      return (data ?? []).map(toPayment)
    },
    enabled: !!bookingId,
  })
}
