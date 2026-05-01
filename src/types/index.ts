import type { Database } from "@/types/database"

export type BusType = "55" | "79"

export type SeatStatus = "free" | "selected" | "reserved" | "sold" | "blocked"

export type TripStatus =
  | "planned"
  | "booking"
  | "confirmed"
  | "in-progress"
  | "completed"
  | "cancelled"

export type RoomType = "single" | "double" | "triple" | "family"

export type Locale = "uk" | "de"

export interface Manager {
  id: string
  name: string
  email: string
  phone: string
  role: "manager" | "owner"
  avatarUrl?: string
}

export interface Client {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  nationality: "UA" | "DE"
  birthDate: Date
  notes?: string
  createdAt: Date
}

export interface Hotel {
  id: string
  name: string
  city: string
  country: string
  stars: 3 | 4 | 5
  rooms: Record<RoomType, { total: number; pricePerNight: number }>
}

export interface HotelBlock {
  hotelId: string
  tripId: string
  checkIn: Date
  checkOut: Date
  allotment: Record<RoomType, number>
}

export interface SeatCell {
  type: "seat"
  id: string
  number: number
  status: SeatStatus
  price?: number
  passengerName?: string
}

export interface SpecialCell {
  type: "special"
  kind: "driver" | "door" | "toilet" | "stairs" | "kitchen"
}

export type Cell = SeatCell | SpecialCell | null

export interface BusLayout {
  busType: BusType
  decks: Cell[][][]
}

export interface Trip {
  id: string
  name: string
  origin: string
  destination: string
  departureDate: Date
  returnDate: Date
  busType: BusType
  status: TripStatus
  basePrice: number
  managerId: string
  hotelIds: string[]
  capacity: number
  bookedCount: number
}

export type PassengerKind = Database["public"]["Enums"]["passenger_kind"]

export interface Passenger {
  id: string
  firstName: string
  lastName: string
  kind: PassengerKind
  seatNumber: number
  hotelId: string
  roomType: RoomType
  price: number
  extraFee?: number
}

export interface Booking {
  id: string
  bookingNumber: string
  contractNumber: string | null
  clientId: string
  tripId: string
  passengers: Passenger[]
  totalPrice: number
  paidAmount: number
  dueDate: Date
  commission: number
  status: "draft" | "confirmed" | "partially_paid" | "paid" | "cancelled" | "no_show"
  managerId: string
  createdAt: Date
}

export interface DashboardStats {
  totalRevenue: number
  activeTripsCount: number
  totalClients: number
  avgOccupancy: number
  upcomingDepartures: number
  revenueByMonth: Array<{
    month: string
    [managerId: string]: string | number
  }>
  topHotels: Array<{ hotelId: string; name: string; bookingsCount: number; percent: number }>
  recentBookings: Booking[]
}
