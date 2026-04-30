import { useQuery } from "@tanstack/react-query"

import { fromDbBusType, fromDbTripStatus } from "@/lib/bus"
import { OCCUPYING_STATUSES } from "@/lib/booking-status"
import { supabase } from "@/lib/supabase"
import type { Trip } from "@/types"
import type { Database } from "@/types/database"

type TripRow = Database["public"]["Tables"]["trips"]["Row"]
type HotelBlockRow = Database["public"]["Tables"]["hotel_blocks"]["Row"]

// Adapter that re-shapes a DB row into the UI Trip type. Mock data
// carried `hotelIds` (array) and `bookedCount` derived fields; we
// derive them from the joined hotel_blocks + a Postgres count.
// `bookedCount` is computed client-side from booking_passengers length
// where the consuming page needs it (cheap at AnyTour scale).
function toTrip(
  row: TripRow & { hotel_blocks?: HotelBlockRow[] | null },
  bookedCount: number,
): Trip {
  const hotelIds = Array.from(new Set((row.hotel_blocks ?? []).map((b) => b.hotel_id)))
  return {
    id: row.id,
    name: row.name,
    origin: row.origin,
    destination: row.destination,
    departureDate: new Date(row.departure_at),
    returnDate: new Date(row.return_at),
    busType: fromDbBusType(row.bus_type),
    status: fromDbTripStatus(row.status),
    basePrice: Number(row.base_price_eur),
    managerId: row.owner_manager_id,
    hotelIds,
    capacity: row.capacity,
    bookedCount,
  }
}

export const tripsKeys = {
  all: ["trips"] as const,
  lists: () => [...tripsKeys.all, "list"] as const,
  detail: (id: string) => [...tripsKeys.all, "detail", id] as const,
  byManager: (managerId: string) => [...tripsKeys.all, "by-manager", managerId] as const,
  byHotel: (hotelId: string) => [...tripsKeys.all, "by-hotel", hotelId] as const,
}

// Helper: fetch booked-passenger counts for a list of trip ids. Only
// passengers attached to bookings whose status is "occupying" (confirmed,
// partially_paid, paid) — cancelled / no_show / draft bookings don't
// hold a seat. AnyTour scale (≤8 trips × 80 seats) makes a single
// round-trip + TS aggregation cheaper than a per-trip count() call.
async function loadBookedCounts(tripIds: string[]): Promise<Map<string, number>> {
  if (tripIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from("booking_passengers")
    .select("trip_id, bookings!inner(status)")
    .in("trip_id", tripIds)
    .in("bookings.status", [...OCCUPYING_STATUSES])
  if (error) throw error
  const counts = new Map<string, number>()
  for (const p of data ?? []) counts.set(p.trip_id, (counts.get(p.trip_id) ?? 0) + 1)
  return counts
}

export function useTrips() {
  return useQuery({
    queryKey: tripsKeys.lists(),
    queryFn: async (): Promise<Trip[]> => {
      const { data, error } = await supabase
        .from("trips")
        .select("*, hotel_blocks(*)")
        .order("departure_at", { ascending: true })
      if (error) throw error
      const counts = await loadBookedCounts((data ?? []).map((t) => t.id))
      return (data ?? []).map((row) =>
        toTrip(row as TripRow & { hotel_blocks: HotelBlockRow[] }, counts.get(row.id) ?? 0),
      )
    },
  })
}

export function useTripById(id: string | undefined) {
  return useQuery({
    queryKey: tripsKeys.detail(id ?? ""),
    queryFn: async (): Promise<Trip | null> => {
      const { data, error } = await supabase
        .from("trips")
        .select("*, hotel_blocks(*)")
        .eq("id", id!)
        .maybeSingle()
      if (error) throw error
      if (!data) return null

      // bookedCount intentionally not fetched here — the trip detail
      // page already loads passenger rows via useBookingsByTrip and can
      // compute the count locally (via passengers.length sum) without
      // an extra count(*) round-trip. List pages use loadBookedCounts()
      // batched for the same reason.
      return toTrip(data as TripRow & { hotel_blocks: HotelBlockRow[] }, 0)
    },
    enabled: !!id,
  })
}

export function useTripsForManager(managerId: string | undefined) {
  return useQuery({
    queryKey: tripsKeys.byManager(managerId ?? ""),
    queryFn: async (): Promise<Trip[]> => {
      const { data, error } = await supabase
        .from("trips")
        .select("*, hotel_blocks(*)")
        .eq("owner_manager_id", managerId!)
        .order("departure_at", { ascending: true })
      if (error) throw error
      const counts = await loadBookedCounts((data ?? []).map((t) => t.id))
      return (data ?? []).map((row) =>
        toTrip(row as TripRow & { hotel_blocks: HotelBlockRow[] }, counts.get(row.id) ?? 0),
      )
    },
    enabled: !!managerId,
  })
}

export function useTripsForHotel(hotelId: string | undefined) {
  return useQuery({
    queryKey: tripsKeys.byHotel(hotelId ?? ""),
    queryFn: async (): Promise<Trip[]> => {
      // Trips whose hotel_blocks reference the hotel.
      const { data: blocks, error: blocksErr } = await supabase
        .from("hotel_blocks")
        .select("trip_id")
        .eq("hotel_id", hotelId!)
      if (blocksErr) throw blocksErr
      const tripIds = Array.from(new Set((blocks ?? []).map((b) => b.trip_id)))
      if (tripIds.length === 0) return []

      const { data, error } = await supabase
        .from("trips")
        .select("*, hotel_blocks(*)")
        .in("id", tripIds)
        .order("departure_at", { ascending: true })
      if (error) throw error
      const counts = await loadBookedCounts(tripIds)
      return (data ?? []).map((row) =>
        toTrip(row as TripRow & { hotel_blocks: HotelBlockRow[] }, counts.get(row.id) ?? 0),
      )
    },
    enabled: !!hotelId,
  })
}

// Returns the set of seat numbers occupied on a trip by any
// "occupying" booking, regardless of whether the caller can read those
// booking rows via RLS. Backed by the SECURITY DEFINER RPC
// public.trip_occupied_seat_numbers — used by the seat map so a manager
// who is neither seller, trip-owner, nor trip-agent still sees true
// occupancy and doesn't try to sell an already-taken seat.
export const tripOccupancyKeys = {
  all: ["trip-occupancy"] as const,
  byTrip: (tripId: string) => [...tripOccupancyKeys.all, tripId] as const,
}

export interface OccupiedSeat {
  seatNumber: number
  paid: boolean
}

export function useOccupiedSeats(tripId: string | undefined) {
  return useQuery({
    queryKey: tripOccupancyKeys.byTrip(tripId ?? ""),
    queryFn: async (): Promise<OccupiedSeat[]> => {
      const { data, error } = await supabase.rpc("trip_occupied_seat_numbers", {
        _trip_id: tripId!,
      })
      if (error) throw error
      return (data ?? []).map((r) => ({ seatNumber: r.seat_number, paid: r.paid }))
    },
    enabled: !!tripId,
  })
}
