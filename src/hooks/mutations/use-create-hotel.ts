import { useMutation, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { hotelsKeys } from "@/hooks/queries/use-hotels"
import { useAuthStore } from "@/stores/auth-store"
import type { Database } from "@/types/database"

type HotelRow = Database["public"]["Tables"]["hotels"]["Row"]
type RoomType = Database["public"]["Enums"]["room_type"]

export interface CreateHotelRoomInput {
  roomType: RoomType
  totalCapacity: number
  pricePerNight: number
}

export interface CreateHotelInput {
  name: string
  city: string
  country: string
  stars: number
  address?: string | null
  notes?: string | null
  rooms: CreateHotelRoomInput[]
}

/**
 * Inserts a new hotel row and its room types.
 *
 * Auth is read inside mutationFn via useAuthStore.getState() — throws
 * Error("no_session") when no active session exists.
 *
 * Step 1: inserts the hotels row (is_active defaults to true at DB layer).
 * Step 2: if rooms.length > 0, inserts all hotel_room_types rows in a
 *   single multi-row INSERT. If step 2 fails after step 1 succeeded the
 *   hotel exists without rooms — acceptable Etap 1 behaviour; operator
 *   can edit to add them.
 *
 * On success: invalidates hotelsKeys.all.
 */
export function useCreateHotel() {
  const queryClient = useQueryClient()

  return useMutation<HotelRow, Error, CreateHotelInput>({
    mutationFn: async (input) => {
      const { tenant } = useAuthStore.getState()
      if (!tenant?.id) throw new Error("no_session")

      const { data: hotelData, error: hotelError } = await supabase
        .from("hotels")
        .insert({
          tenant_id: tenant.id,
          name: input.name,
          city: input.city,
          country: input.country.toUpperCase(),
          stars: input.stars,
          address: input.address ?? null,
          notes: input.notes ?? null,
        })
        .select()
        .single()

      if (hotelError) throw hotelError

      if (input.rooms.length > 0) {
        const { error: roomsError } = await supabase.from("hotel_room_types").insert(
          input.rooms.map((r) => ({
            tenant_id: tenant.id,
            hotel_id: hotelData.id,
            room_type: r.roomType,
            total_capacity: r.totalCapacity,
            price_per_night_eur: r.pricePerNight,
          })),
        )
        if (roomsError) throw roomsError
      }

      return hotelData
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hotelsKeys.all })
    },
  })
}
