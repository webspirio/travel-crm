import { useMutation, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { hotelBlocksKeys } from "@/hooks/queries/use-hotel-blocks"
import { tripsKeys } from "@/hooks/queries/use-trips"
import { useAuthStore } from "@/stores/auth-store"

export interface DeleteHotelBlockInput {
  id: string
  /** Only for cache invalidation. */
  tripId: string
}

/**
 * Deletes a hotel_blocks row by id.
 *
 * Auth is read inside mutationFn via useAuthStore.getState() — throws
 * Error("no_session") when no active session exists.
 *
 * The caller is responsible for showing a confirmation dialog before
 * invoking this mutation, especially when qty_used > 0 (existing
 * bookings are consuming this block).
 *
 * On success: invalidates hotelBlocksKeys.byTrip(tripId) and
 * tripsKeys.detail(tripId).
 */
export function useDeleteHotelBlock() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, DeleteHotelBlockInput>({
    mutationFn: async ({ id }) => {
      const { tenant } = useAuthStore.getState()
      if (!tenant?.id) throw new Error("no_session")

      const { error } = await supabase
        .from("hotel_blocks")
        .delete()
        .eq("id", id)

      if (error) throw error
    },

    onSuccess: (_data, { tripId }) => {
      void queryClient.invalidateQueries({ queryKey: hotelBlocksKeys.byTrip(tripId) })
      void queryClient.invalidateQueries({ queryKey: tripsKeys.detail(tripId) })
    },
  })
}
