import { useMutation, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { bookingsKeys } from "@/hooks/queries/use-bookings"
import { tripOccupancyKeys } from "@/hooks/queries/use-trips"
import { tripSeatsKeys } from "@/hooks/queries/use-trip-seats"
import { useAuthStore } from "@/stores/auth-store"
import type { Database, Json } from "@/types/database"

type PassengerRow = Database["public"]["Tables"]["booking_passengers"]["Row"]
type RoomType = Database["public"]["Enums"]["room_type"]

export interface UpdatePassengerPatch {
  first_name?: string
  last_name?: string
  birth_date?: string | null
  seat_number?: number | null
  hotel_id?: string | null
  room_type?: RoomType | null
  price_total_eur?: number
  price_breakdown?: Record<string, unknown>
  special_notes?: string | null
}

export interface UpdatePassengerWithReasonInput {
  /** booking_passenger row id (NOT booking id) */
  id: string
  /** parent booking id — used solely for cache invalidation */
  bookingId: string
  patch: UpdatePassengerPatch
  reason?: string
}

/**
 * Updates a single booking_passengers row via the
 * `update_passenger_with_reason` RPC (Phase 1, T2). Sensitive fields trigger
 * the DB-level reason check; the hook passes whatever the caller supplies.
 *
 * On success invalidates:
 *   1. bookingsKeys.detail(bookingId)  — booking detail re-renders
 *   2. bookingsKeys.lists()            — list shows updated passenger names
 *   3. tripSeatsKeys.byTrip(tripId)
 *   4. tripOccupancyKeys.byTrip(tripId)
 *      (#3 + #4 only when the patch touched seat_number — seat reassignment
 *      changes occupancy.)
 *   (TODO T11 — also invalidate bookingHistoryKeys.detail(bookingId).)
 */
export function useUpdatePassengerWithReason() {
  const queryClient = useQueryClient()

  return useMutation<PassengerRow, Error, UpdatePassengerWithReasonInput>({
    mutationFn: async ({ id, patch, reason }) => {
      const { tenant } = useAuthStore.getState()
      if (!tenant?.id) throw new Error("no_session")

      const cleanPatch = JSON.parse(JSON.stringify(patch)) as Json

      const { data, error } = await supabase.rpc("update_passenger_with_reason", {
        p_id: id,
        p_patch: cleanPatch,
        p_reason: reason ?? "",
      })
      if (error) throw error
      if (!data) throw new Error("rpc returned no row")
      return data as PassengerRow
    },

    onSuccess: (row, { bookingId, patch }) => {
      void queryClient.invalidateQueries({ queryKey: bookingsKeys.detail(bookingId) })
      void queryClient.invalidateQueries({ queryKey: bookingsKeys.lists() })

      // Seat reassignment → bust the trip-scoped seat caches so the seat map
      // and occupancy overlay re-fetch.
      if ("seat_number" in patch && row.trip_id) {
        void queryClient.invalidateQueries({ queryKey: tripSeatsKeys.byTrip(row.trip_id) })
        void queryClient.invalidateQueries({ queryKey: tripOccupancyKeys.byTrip(row.trip_id) })
      }
    },
  })
}
