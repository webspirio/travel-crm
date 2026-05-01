import { useMutation, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { hotelsKeys } from "@/hooks/queries/use-hotels"
import { useAuthStore } from "@/stores/auth-store"
import type { Database } from "@/types/database"
import type { CreateHotelInput } from "./use-create-hotel"

type HotelRow = Database["public"]["Tables"]["hotels"]["Row"]
type RoomType = Database["public"]["Enums"]["room_type"]

export interface UpdateHotelInput {
  id: string
  patch: Partial<CreateHotelInput> & { isActive?: boolean }
}

/**
 * Updates an existing hotel row and optionally replaces its room types.
 *
 * Auth is read inside mutationFn via useAuthStore.getState() — only used
 * as a guard; RLS enforces tenant isolation at the DB layer.
 * Throws Error("no_session") when the store has no active session.
 *
 * Hotel fields: only fields present in patch (not undefined) are sent.
 *
 * Rooms diffing strategy (only when patch.rooms is provided):
 *   - patch.rooms === undefined → don't touch room types at all
 *   - patch.rooms === []        → delete all existing rooms for this hotel
 *   - patch.rooms.length > 0   → upsert desired rows (composite unique key
 *     hotel_id+room_type), then delete any existing rows whose room_type is
 *     no longer in the desired set
 *
 * Failure modes (Etap 1 — no compensation):
 * - If the hotel UPDATE succeeds but the rooms fetch / upsert / delete
 *   fails, the mutation throws and the hotel may be in a partially
 *   updated state. The next refetch shows the actual DB state; manual
 *   retry from the dialog is the recovery path.
 * - The composite trigger `hotel_room_types_assert_same_tenant`
 *   guarantees tenant isolation even if a stale ID slipped through.
 *
 * On success: invalidates hotelsKeys.all (prefix-match covers all descendant
 * keys, including detail(id)).
 */
export function useUpdateHotel() {
  const queryClient = useQueryClient()

  return useMutation<HotelRow, Error, UpdateHotelInput>({
    mutationFn: async ({ id, patch }) => {
      const { tenant } = useAuthStore.getState()
      if (!tenant?.id) throw new Error("no_session")

      const dbPatch: Database["public"]["Tables"]["hotels"]["Update"] = {}

      if (patch.name !== undefined) dbPatch.name = patch.name
      if (patch.city !== undefined) dbPatch.city = patch.city
      if (patch.country !== undefined) dbPatch.country = patch.country.toUpperCase()
      if (patch.stars !== undefined) dbPatch.stars = patch.stars
      if (patch.address !== undefined) dbPatch.address = patch.address ?? null
      if (patch.notes !== undefined) dbPatch.notes = patch.notes ?? null
      if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive

      const { data, error } = await supabase
        .from("hotels")
        .update(dbPatch)
        .eq("id", id)
        .select()
        .single()

      if (error) throw error

      // Rooms diffing — only when patch.rooms is explicitly provided
      if (patch.rooms !== undefined) {
        // Fetch existing room rows for diff
        const { data: existingRooms, error: fetchError } = await supabase
          .from("hotel_room_types")
          .select("id, room_type")
          .eq("hotel_id", id)

        if (fetchError) throw fetchError

        const desiredSet = new Set<RoomType>(patch.rooms.map((r) => r.roomType))

        // Upsert all desired rows
        if (patch.rooms.length > 0) {
          const { error: upsertError } = await supabase.from("hotel_room_types").upsert(
            patch.rooms.map((r) => ({
              tenant_id: tenant.id,
              hotel_id: id,
              room_type: r.roomType,
              total_capacity: r.totalCapacity,
              price_per_night_eur: r.pricePerNight,
            })),
            { onConflict: "hotel_id,room_type" },
          )
          if (upsertError) throw upsertError
        }

        // Delete rows whose room_type is no longer in desired set
        const toDelete = (existingRooms ?? [])
          .filter((r) => !desiredSet.has(r.room_type as RoomType))
          .map((r) => r.id)

        if (toDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from("hotel_room_types")
            .delete()
            .in("id", toDelete)
          if (deleteError) throw deleteError
        }
      }

      return data
    },

    onSuccess: () => {
      // hotelsKeys.all is ["hotels"] — react-query prefix-match invalidation
      // covers all descendant keys including detail(id), so no explicit
      // detail invalidation is needed.
      void queryClient.invalidateQueries({ queryKey: hotelsKeys.all })
    },
  })
}
