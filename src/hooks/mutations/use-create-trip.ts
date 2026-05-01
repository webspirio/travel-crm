import { useMutation, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { toDbBusType } from "@/lib/bus"
import { tripsKeys } from "@/hooks/queries/use-trips"
import { useAuthStore } from "@/stores/auth-store"
import type { BusType } from "@/types"
import type { Database } from "@/types/database"

type TripRow = Database["public"]["Tables"]["trips"]["Row"]

export interface CreateTripInput {
  name: string
  origin: string
  destination: string
  ownerManagerId: string
  busType: BusType
  capacity: number
  departureAt: Date
  returnAt: Date
  basePriceEur: number
  childPriceEur: number
  infantPriceEur: number
  frontRowsCount: number
  frontRowsSurchargeEur: number
  notes?: string | null
}

/**
 * Inserts a new trip row.
 *
 * Auth is read inside mutationFn via useAuthStore.getState() — throws
 * Error("no_session") when no active session exists.
 *
 * DB triggers materialise trip_seats and trip_stops automatically on
 * INSERT; this hook only writes the trip row itself.
 *
 * On success: invalidates tripsKeys.all so all list views, dashboard,
 * and finance queries that consume trips are refreshed.
 */
export function useCreateTrip() {
  const queryClient = useQueryClient()

  return useMutation<TripRow, Error, CreateTripInput>({
    mutationFn: async (input) => {
      const { tenant } = useAuthStore.getState()
      if (!tenant?.id) throw new Error("no_session")

      const { data, error } = await supabase
        .from("trips")
        .insert({
          tenant_id: tenant.id,
          name: input.name,
          origin: input.origin,
          destination: input.destination,
          owner_manager_id: input.ownerManagerId,
          bus_type: toDbBusType(input.busType),
          capacity: input.capacity,
          departure_at: input.departureAt.toISOString(),
          return_at: input.returnAt.toISOString(),
          base_price_eur: input.basePriceEur,
          child_price_eur: input.childPriceEur,
          infant_price_eur: input.infantPriceEur,
          front_rows_count: input.frontRowsCount,
          front_rows_surcharge_eur: input.frontRowsSurchargeEur,
          notes: input.notes ?? null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tripsKeys.all })
    },
  })
}
