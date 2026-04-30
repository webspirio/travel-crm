import { useQuery } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import type { Booking, Passenger, RoomType } from "@/types"
import type { Database } from "@/types/database"

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"]
type BookingPassengerRow = Database["public"]["Tables"]["booking_passengers"]["Row"]

// Adapter: DB row + passengers → UI Booking. The DB and UI status
// unions are aligned (6 values); the adapter passes status through
// directly so the UI can distinguish partially_paid from confirmed
// and no_show from cancelled (relevant for finance dashboards).

function toPassenger(row: BookingPassengerRow): Passenger {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    seatNumber: row.seat_number ?? 0,
    hotelId: row.hotel_id ?? "",
    roomType: (row.room_type ?? "double") as RoomType,
    price: Number(row.price_total_eur),
  }
}

function toBooking(row: BookingRow & { booking_passengers: BookingPassengerRow[] }): Booking {
  return {
    id: row.id,
    contractNumber: row.contract_number ?? row.booking_number,
    clientId: row.client_id,
    tripId: row.trip_id,
    passengers: (row.booking_passengers ?? []).map(toPassenger),
    totalPrice: Number(row.total_price_eur),
    paidAmount: Number(row.paid_amount_eur),
    dueDate: row.due_date ? new Date(row.due_date) : new Date(row.created_at),
    commission: Number(row.commission_eur),
    status: row.status,
    managerId: row.sold_by_manager_id,
    createdAt: new Date(row.created_at),
  }
}

export const bookingsKeys = {
  all: ["bookings"] as const,
  lists: () => [...bookingsKeys.all, "list"] as const,
  detail: (id: string) => [...bookingsKeys.all, "detail", id] as const,
  byTrip: (tripId: string) => [...bookingsKeys.all, "by-trip", tripId] as const,
  byClient: (clientId: string) => [...bookingsKeys.all, "by-client", clientId] as const,
}

export function useBookings() {
  return useQuery({
    queryKey: bookingsKeys.lists(),
    queryFn: async (): Promise<Booking[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, booking_passengers(*)")
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) =>
        toBooking(r as BookingRow & { booking_passengers: BookingPassengerRow[] }),
      )
    },
  })
}

export function useBookingById(id: string | undefined) {
  return useQuery({
    queryKey: bookingsKeys.detail(id ?? ""),
    queryFn: async (): Promise<Booking | null> => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, booking_passengers(*)")
        .eq("id", id!)
        .maybeSingle()
      if (error) throw error
      return data
        ? toBooking(data as BookingRow & { booking_passengers: BookingPassengerRow[] })
        : null
    },
    enabled: !!id,
  })
}

export function useBookingsByTrip(tripId: string | undefined) {
  return useQuery({
    queryKey: bookingsKeys.byTrip(tripId ?? ""),
    queryFn: async (): Promise<Booking[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, booking_passengers(*)")
        .eq("trip_id", tripId!)
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) =>
        toBooking(r as BookingRow & { booking_passengers: BookingPassengerRow[] }),
      )
    },
    enabled: !!tripId,
  })
}

export function useBookingsByClient(clientId: string | undefined) {
  return useQuery({
    queryKey: bookingsKeys.byClient(clientId ?? ""),
    queryFn: async (): Promise<Booking[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, booking_passengers(*)")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) =>
        toBooking(r as BookingRow & { booking_passengers: BookingPassengerRow[] }),
      )
    },
    enabled: !!clientId,
  })
}
