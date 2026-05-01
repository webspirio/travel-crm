import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { supabase } from "@/lib/supabase"
import { bookingsKeys } from "@/hooks/queries/use-bookings"
import type { Database } from "@/types/database"

type BookingStatus = Database["public"]["Enums"]["booking_status"]

export interface UpdateBookingStatusInput {
  id: string
  status: BookingStatus
}

interface UpdateResult {
  tripId: string
}

export function useUpdateBookingStatus() {
  const queryClient = useQueryClient()

  return useMutation<UpdateResult, Error, UpdateBookingStatusInput>({
    mutationFn: async ({ id, status }) => {
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
      // Invalidate the detail cache for this booking.
      void queryClient.invalidateQueries({ queryKey: bookingsKeys.detail(id) })
      // Invalidate the trip-scoped booking list (seat map + passenger table).
      // Note: bookingsKeys.all is intentionally NOT invalidated here.
      // bookingsKeys.byTrip and detail are descendants of ["bookings"] and
      // invalidating `all` would force every list/by-client query to refetch
      // when only the specific booking's trip view actually changed.
      void queryClient.invalidateQueries({ queryKey: bookingsKeys.byTrip(result.tripId) })
    },

    onError: (error) => {
      toast.error(error.message)
    },
  })
}
