import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import type { Booking, Passenger, PassengerKind, RoomType } from "@/types"
import type { Database } from "@/types/database"

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"]
type BookingPassengerRow = Database["public"]["Tables"]["booking_passengers"]["Row"]
type BookingsSearchViewRow = Database["public"]["Views"]["bookings_search_view"]["Row"]
type BookingStatus = Database["public"]["Enums"]["booking_status"]

// Re-export so consumers don't need to know the generated path.
export type BookingsListRow = BookingsSearchViewRow

// Adapter: DB row + passengers → UI Booking. The DB and UI status
// unions are aligned (6 values); the adapter passes status through
// directly so the UI can distinguish partially_paid from confirmed
// and no_show from cancelled (relevant for finance dashboards).

function toPassenger(row: BookingPassengerRow): Passenger {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    kind: (row.kind ?? "adult") as PassengerKind,
    seatNumber: row.seat_number ?? null,
    hotelId: row.hotel_id ?? "",
    roomType: (row.room_type ?? "double") as RoomType,
    price: Number(row.price_total_eur),
    birthDate: row.birth_date ? new Date(row.birth_date) : null,
    specialNotes: row.special_notes ?? null,
  }
}

function toBooking(row: BookingRow & { booking_passengers: BookingPassengerRow[] }): Booking {
  return {
    id: row.id,
    bookingNumber: row.booking_number,
    contractNumber: row.contract_number ?? null,
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
    notes: row.notes ?? null,
  }
}

export const bookingsKeys = {
  all: ["bookings"] as const,
  // Prefix key — any list-shape query (legacy or paginated) starts with this.
  // Mutations invalidating this prefix bust both `lists()` and `list(params)`
  // because React Query uses prefix-matching on query keys.
  lists: () => [...bookingsKeys.all, "list"] as const,
  // Parameterized server-driven list. queryKey is a SUPERSET of `lists()` —
  // sharing the "list" discriminator ensures `lists()` invalidations cascade.
  list: (params: BookingsListParams) => [...bookingsKeys.all, "list", params] as const,
  detail: (id: string) => [...bookingsKeys.all, "detail", id] as const,
  byTrip: (tripId: string) => [...bookingsKeys.all, "by-trip", tripId] as const,
  byClient: (clientId: string) => [...bookingsKeys.all, "by-client", clientId] as const,
}

export function useBookings() {
  return useQuery({
    queryKey: bookingsKeys.lists(),
    queryFn: async (): Promise<Booking[]> => {
      // RLS allows owners to see deleted rows via the soft-delete branch
      // of bookings_select; the main list filters them client-side.
      const { data, error } = await supabase
        .from("bookings")
        .select("*, booking_passengers(*)")
        .is("deleted_at", null)
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
        .is("deleted_at", null)
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
        .is("deleted_at", null)
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
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) =>
        toBooking(r as BookingRow & { booking_passengers: BookingPassengerRow[] }),
      )
    },
    enabled: !!clientId,
  })
}

// Server-driven, paginated query against bookings_search_view (T3). Backs
// the new bookings list page (T6). The view already filters deleted_at IS
// NULL and is created with security_invoker=true, so RLS is enforced via
// the caller's session — no need to inject tenant_id here.

export interface BookingsListParams {
  search?: string // free text — debounced by caller
  status?: BookingStatus[]
  tripId?: string // single trip id
  departureFrom?: string // ISO date — gte trip_departure_at
  departureTo?: string // ISO date — lte trip_departure_at
  soldByManagerId?: string
  outstandingOnly?: boolean
  sorting?: { id: string; desc: boolean }[] // TanStack SortingState shape
  pagination?: { pageIndex: number; pageSize: number }
}

export interface BookingsListResult {
  rows: BookingsListRow[]
  totalRows: number
  pageCount: number
}

export function useBookingsList(
  params: BookingsListParams,
): UseQueryResult<BookingsListResult> {
  return useQuery({
    queryKey: bookingsKeys.list(params),
    queryFn: async (): Promise<BookingsListResult> => {
      const {
        search,
        status,
        tripId,
        departureFrom,
        departureTo,
        soldByManagerId,
        outstandingOnly,
        sorting = [{ id: "created_at", desc: true }],
        pagination = { pageIndex: 0, pageSize: 20 },
      } = params

      // count: 'exact' returns totalRows in the response `count` field —
      // needed to drive pagination controls in the table footer.
      let q = supabase.from("bookings_search_view").select("*", { count: "exact" })

      if (search && search.trim().length > 0) {
        const term = `%${search.trim()}%`
        // Substring search across 4 columns. PostgREST `or()` syntax
        // requires comma-separated alternatives.
        q = q.or(
          [
            `booking_number.ilike.${term}`,
            `contract_number.ilike.${term}`,
            `client_full_name.ilike.${term}`,
            `passenger_full_names.ilike.${term}`,
          ].join(","),
        )
      }

      if (status && status.length > 0) q = q.in("status", status)
      if (tripId) q = q.eq("trip_id", tripId)
      if (soldByManagerId) q = q.eq("sold_by_manager_id", soldByManagerId)
      if (departureFrom) q = q.gte("trip_departure_at", departureFrom)
      if (departureTo) q = q.lte("trip_departure_at", departureTo)
      if (outstandingOnly) q = q.gt("outstanding_eur", 0)

      // Sorting — translate TanStack SortingState to PostgREST `.order()`
      // chain. Multiple sort orders are stable.
      for (const s of sorting) {
        q = q.order(s.id, { ascending: !s.desc })
      }

      // Pagination — server-side range. PostgREST is inclusive on both ends.
      const from = pagination.pageIndex * pagination.pageSize
      const to = from + pagination.pageSize - 1
      q = q.range(from, to)

      const { data, error, count } = await q
      if (error) throw error
      const totalRows = count ?? 0
      const pageCount = Math.max(1, Math.ceil(totalRows / pagination.pageSize))
      return {
        rows: data ?? [],
        totalRows,
        pageCount,
      }
    },
    // Smooth UX on top of the isLoading indicator from T4 — old page stays
    // visible while the next page / new filter result is fetching.
    placeholderData: keepPreviousData,
  })
}
