import { useMutation, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { hotelBlocksKeys } from "@/hooks/queries/use-hotel-blocks"
import { tripsKeys } from "@/hooks/queries/use-trips"
import { useAuthStore } from "@/stores/auth-store"
import type { Database } from "@/types/database"

type HotelBlockRow = Database["public"]["Tables"]["hotel_blocks"]["Row"]

export interface UpdateHotelBlockInput {
  id: string
  /** Only for cache invalidation — the UPDATE itself is by id. */
  tripId: string
  patch: {
    qtyTotal?: number
    notes?: string | null
  }
}

/**
 * Updates an existing hotel_blocks row by id.
 *
 * Auth is read inside mutationFn via useAuthStore.getState() — throws
 * Error("no_session") when no active session exists.
 *
 * hotelId and roomType are NOT editable: they form part of the composite
 * PK (trip_id, hotel_id, room_type). If the operator needs to change
 * those fields, delete + create is the correct flow.
 *
 * Only fields present in patch (not undefined) are sent to the DB.
 *
 * If qtyTotal < current qty_used the DB CHECK (qty_used <= qty_total)
 * will reject. Surface the Postgres error via toast at the call site.
 *
 * On success: invalidates hotelBlocksKeys.byTrip(tripId) and
 * tripsKeys.detail(tripId).
 */
export function useUpdateHotelBlock() {
  const queryClient = useQueryClient()

  return useMutation<HotelBlockRow, Error, UpdateHotelBlockInput>({
    mutationFn: async ({ id, patch }) => {
      const { tenant } = useAuthStore.getState()
      if (!tenant?.id) throw new Error("no_session")

      const dbPatch: Database["public"]["Tables"]["hotel_blocks"]["Update"] = {}

      if (patch.qtyTotal !== undefined) dbPatch.qty_total = patch.qtyTotal
      if (patch.notes !== undefined) dbPatch.notes = patch.notes

      const { data, error } = await supabase
        .from("hotel_blocks")
        .update(dbPatch)
        .eq("id", id)
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
