import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { supabase } from "@/lib/supabase"
import { bookingsKeys } from "@/hooks/queries/use-bookings"
import type { Booking } from "@/types"
import type { Database } from "@/types/database"

type BookingStatus = Database["public"]["Enums"]["booking_status"]

export interface UpdateBookingStatusInput {
  id: string
  status: BookingStatus
}

export function useUpdateBookingStatus() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, UpdateBookingStatusInput>({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ status })
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
    },

    onSuccess: (_data, { id }) => {
      // Invalidate the detail cache for this booking.
      void queryClient.invalidateQueries({ queryKey: bookingsKeys.detail(id) })

      // Invalidate the bookings list cache.
      void queryClient.invalidateQueries({ queryKey: bookingsKeys.all })

      // If the booking's tripId is known from the cache, also invalidate byTrip.
      const cached = queryClient.getQueryData<Booking>(bookingsKeys.detail(id))
      if (cached?.tripId) {
        void queryClient.invalidateQueries({
          queryKey: bookingsKeys.byTrip(cached.tripId),
        })
      }
    },

    onError: (error) => {
      toast.error(error.message)
    },
  })
}
