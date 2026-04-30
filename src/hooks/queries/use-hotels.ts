import { useQuery } from "@tanstack/react-query"

import { countryCodeToName } from "@/lib/countries"
import { supabase } from "@/lib/supabase"
import type { Hotel, RoomType } from "@/types"
import type { Database } from "@/types/database"

type HotelRow = Database["public"]["Tables"]["hotels"]["Row"]
type RoomTypeRow = Database["public"]["Tables"]["hotel_room_types"]["Row"]

// Adapter: re-nests hotel_room_types under Hotel.rooms to keep the UI
// shape stable. The DB normalises room types into a separate table
// (better for indexing and audit), but pages still expect the
// Record<RoomType, {total, pricePerNight}> shape.
function toHotel(row: HotelRow & { hotel_room_types: RoomTypeRow[] }): Hotel {
  const rooms = {
    single: { total: 0, pricePerNight: 0 },
    double: { total: 0, pricePerNight: 0 },
    triple: { total: 0, pricePerNight: 0 },
    family: { total: 0, pricePerNight: 0 },
  } satisfies Record<RoomType, { total: number; pricePerNight: number }>
  for (const rt of row.hotel_room_types) {
    rooms[rt.room_type as RoomType] = {
      total: rt.total_capacity,
      pricePerNight: Number(rt.price_per_night_eur),
    }
  }
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    country: countryCodeToName(row.country),
    stars: (row.stars ?? 3) as 3 | 4 | 5,
    rooms,
  }
}

export const hotelsKeys = {
  all: ["hotels"] as const,
  lists: () => [...hotelsKeys.all, "list"] as const,
  detail: (id: string) => [...hotelsKeys.all, "detail", id] as const,
}

export function useHotels() {
  return useQuery({
    queryKey: hotelsKeys.lists(),
    queryFn: async (): Promise<Hotel[]> => {
      const { data, error } = await supabase
        .from("hotels")
        .select("*, hotel_room_types(*)")
        .eq("is_active", true)
        .order("name")
      if (error) throw error
      return (data ?? []).map((r) => toHotel(r as HotelRow & { hotel_room_types: RoomTypeRow[] }))
    },
  })
}

export function useHotelById(id: string | undefined) {
  return useQuery({
    queryKey: hotelsKeys.detail(id ?? ""),
    queryFn: async (): Promise<Hotel | null> => {
      const { data, error } = await supabase
        .from("hotels")
        .select("*, hotel_room_types(*)")
        .eq("id", id!)
        .maybeSingle()
      if (error) throw error
      return data ? toHotel(data as HotelRow & { hotel_room_types: RoomTypeRow[] }) : null
    },
    enabled: !!id,
  })
}
