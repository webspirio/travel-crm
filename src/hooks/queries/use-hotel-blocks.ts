import { useQuery } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database"

export type HotelBlock = Database["public"]["Tables"]["hotel_blocks"]["Row"]

export const hotelBlocksKeys = {
  all: ["hotel_blocks"] as const,
  byTrip: (tripId: string) => [...hotelBlocksKeys.all, "by-trip", tripId] as const,
}

export function useHotelBlocks(tripId: string | undefined) {
  return useQuery({
    queryKey: hotelBlocksKeys.byTrip(tripId ?? ""),
    queryFn: async (): Promise<HotelBlock[]> => {
      const { data, error } = await supabase
        .from("hotel_blocks")
        .select("*")
        .eq("trip_id", tripId!)
      if (error) throw error
      return data ?? []
    },
    enabled: !!tripId,
  })
}
