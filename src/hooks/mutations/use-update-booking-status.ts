import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { supabase } from "@/lib/supabase"
import { bookingsKeys } from "@/hooks/queries/use-bookings"
import { tripOccupancyKeys } from "@/hooks/queries/use-trips"
import { tripSeatsKeys } from "@/hooks/queries/use-trip-seats"
import { useAuthStore } from "@/stores/auth-store"
import type { Database } from "@/types/database"

type BookingStatus = Database["public"]["Enums"]["booking_status"]

export interface UpdateBookingStatusInput {
  id: string
  status: BookingStatus
}

interface UpdateResult {
  tripId: string
}

/**
 * Flips the status of a single booking.
 *
 * Auth guard: throws Error("no_session") when the store has no active
 * tenant — mirrors the pattern used in all other mutation hooks.
 *
 * On success, invalidates the following query keys so all downstream
 * views stay consistent:
 *   1. bookingsKeys.detail(id)          — booking detail page header
 *   2. bookingsKeys.byTrip(tripId)      — trip passenger table
 *   3. bookingsKeys.lists()             — dashboard "recent bookings" + finance tables
 *   4. tripOccupancyKeys.byTrip(tripId) — seat map occupied-seat overlay
 *   5. tripSeatsKeys.byTrip(tripId)     — seat status materialised rows
 */
export function useUpdateBookingStatus() {
  const queryClient = useQueryClient()

  return useMutation<UpdateResult, Error, UpdateBookingStatusInput>({
    mutationFn: async ({ id, status }) => {
      const { tenant } = useAuthStore.getState()
      if (!tenant?.id) throw new Error("no_session")

      const { data, error } = await supabase
        .from("bookings")
        .update({ status })
        .eq("id", id)
        .select("trip_id")
        .single()
      if (error) throw error
      return { tripId: data.trip_id }
    },

    onSuccess: (result, { id }) => {
      // 1. Booking detail cache.
      void queryClient.invalidateQueries({ queryKey: bookingsKeys.detail(id) })
      // 2. Trip-scoped booking list (passenger table in trip detail).
      void queryClient.invalidateQueries({ queryKey: bookingsKeys.byTrip(result.tripId) })
      // 3. Global booking lists (dashboard recent bookings + finance tables).
      void queryClient.invalidateQueries({ queryKey: bookingsKeys.lists() })
      // 4. Occupied-seat RPC cache (seat map overlay).
      void queryClient.invalidateQueries({ queryKey: tripOccupancyKeys.byTrip(result.tripId) })
      // 5. Materialised trip_seats rows (seat-map status colours).
      void queryClient.invalidateQueries({ queryKey: tripSeatsKeys.byTrip(result.tripId) })
    },

    onError: (error) => {
      toast.error(error.message)
    },
  })
}
