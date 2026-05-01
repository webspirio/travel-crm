import { useMutation, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { hotelBlocksKeys } from "@/hooks/queries/use-hotel-blocks"
import { tripsKeys } from "@/hooks/queries/use-trips"
import { useAuthStore } from "@/stores/auth-store"
import type { Database } from "@/types/database"

type HotelBlockRow = Database["public"]["Tables"]["hotel_blocks"]["Row"]
type RoomType = Database["public"]["Enums"]["room_type"]

export interface CreateHotelBlockInput {
  tripId: string
  hotelId: string
  roomType: RoomType
  qtyTotal: number
  notes?: string | null
}

/**
 * Inserts a new hotel_blocks row for a trip.
 *
 * Auth is read inside mutationFn via useAuthStore.getState() — throws
 * Error("no_session") when no active session exists.
 *
 * qty_used is NOT passed — the DB defaults it to 0. The composite PK
 * (trip_id, hotel_id, room_type) prevents duplicate blocks.
 *
 * On success: invalidates hotelBlocksKeys.byTrip(tripId) and
 * tripsKeys.detail(tripId) because toTrip() derives hotelIds from blocks.
 */
export function useCreateHotelBlock() {
  const queryClient = useQueryClient()

  return useMutation<HotelBlockRow, Error, CreateHotelBlockInput>({
    mutationFn: async (input) => {
      const { tenant } = useAuthStore.getState()
      if (!tenant?.id) throw new Error("no_session")

      const { data, error } = await supabase
        .from("hotel_blocks")
        .insert({
          tenant_id: tenant.id,
          trip_id: input.tripId,
          hotel_id: input.hotelId,
          room_type: input.roomType,
          qty_total: input.qtyTotal,
          notes: input.notes ?? null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },

    onSuccess: (_data, { tripId }) => {
      void queryClient.invalidateQueries({ queryKey: hotelBlocksKeys.byTrip(tripId) })
      void queryClient.invalidateQueries({ queryKey: tripsKeys.detail(tripId) })
    },
  })
}
