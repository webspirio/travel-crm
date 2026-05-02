import { useQuery } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database"

export type TripSeat = Database["public"]["Tables"]["trip_seats"]["Row"]

export const tripSeatsKeys = {
  all: ["trip_seats"] as const,
  byTrip: (tripId: string) => [...tripSeatsKeys.all, "by-trip", tripId] as const,
}

/**
 * Returns the materialised seat rows for a trip, ordered by seat_number.
 * Status reflects DB state: free / reserved / sold / blocked.
 *
 * Phase 2 doesn't subscribe to realtime here — Phase 3 wires the
 * seat-map presence channel for the booking wizard. For now react-query
 * staleTime is long enough that a manual refresh between seat picks is
 * acceptable for non-concurrent usage.
 */
export function useTripSeats(tripId: string | undefined) {
  return useQuery({
    queryKey: tripSeatsKeys.byTrip(tripId ?? ""),
    queryFn: async (): Promise<TripSeat[]> => {
      const { data, error } = await supabase
        .from("trip_seats")
        .select("*")
        .eq("trip_id", tripId!)
        .order("seat_number")
      if (error) throw error
      return data ?? []
    },
    enabled: !!tripId,
  })
}
