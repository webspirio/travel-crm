import { useMutation, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { toDbBusType, toDbTripStatus } from "@/lib/bus"
import { tripsKeys } from "@/hooks/queries/use-trips"
import { useAuthStore } from "@/stores/auth-store"
import type { TripStatus } from "@/types"
import type { Database } from "@/types/database"
import type { CreateTripInput } from "./use-create-trip"

type TripRow = Database["public"]["Tables"]["trips"]["Row"]

export interface UpdateTripInput {
  id: string
  patch: Partial<CreateTripInput> & { status?: TripStatus }
}

/**
 * Updates an existing trip row by id.
 *
 * Auth is read inside mutationFn via useAuthStore.getState() — only used
 * as a guard; RLS enforces tenant isolation at the DB layer.
 * Throws Error("no_session") when the store has no active session.
 *
 * Only fields present in `patch` (not undefined) are sent to the DB.
 *
 * On success: invalidates tripsKeys.all (prefix-match covers all descendant
 * keys, including detail(id)).
 */
export function useUpdateTrip() {
  const queryClient = useQueryClient()

  return useMutation<TripRow, Error, UpdateTripInput>({
    mutationFn: async ({ id, patch }) => {
      const { tenant } = useAuthStore.getState()
      if (!tenant?.id) throw new Error("no_session")

      const dbPatch: Database["public"]["Tables"]["trips"]["Update"] = {}

      if (patch.name !== undefined) dbPatch.name = patch.name
      if (patch.origin !== undefined) dbPatch.origin = patch.origin
      if (patch.destination !== undefined) dbPatch.destination = patch.destination
      if (patch.ownerManagerId !== undefined) dbPatch.owner_manager_id = patch.ownerManagerId
      if (patch.busType !== undefined) dbPatch.bus_type = toDbBusType(patch.busType)
      if (patch.capacity !== undefined) dbPatch.capacity = patch.capacity
      if (patch.departureAt !== undefined) dbPatch.departure_at = patch.departureAt.toISOString()
      if (patch.returnAt !== undefined) dbPatch.return_at = patch.returnAt.toISOString()
      if (patch.basePriceEur !== undefined) dbPatch.base_price_eur = patch.basePriceEur
      if (patch.childPriceEur !== undefined) dbPatch.child_price_eur = patch.childPriceEur
      if (patch.infantPriceEur !== undefined) dbPatch.infant_price_eur = patch.infantPriceEur
      if (patch.frontRowsCount !== undefined) dbPatch.front_rows_count = patch.frontRowsCount
      if (patch.frontRowsSurchargeEur !== undefined)
        dbPatch.front_rows_surcharge_eur = patch.frontRowsSurchargeEur
      if (patch.notes !== undefined) dbPatch.notes = patch.notes ?? null
      if (patch.status !== undefined) dbPatch.status = toDbTripStatus(patch.status)

      const { data, error } = await supabase
        .from("trips")
        .update(dbPatch)
        .eq("id", id)
        .select()
        .single()

      if (error) throw error
      return data
    },

    onSuccess: () => {
      // tripsKeys.all is ["trips"] — react-query prefix-match invalidation
      // covers all descendant keys including detail(id), so no explicit
      // detail invalidation is needed.
      void queryClient.invalidateQueries({ queryKey: tripsKeys.all })
    },
  })
}
