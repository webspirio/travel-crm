import type { Booking, DashboardStats, Hotel, Manager, RoomType, Trip } from "@/types"

export function computeStats(
  trips: Trip[],
  bookings: Booking[],
  hotels: Hotel[],
  managers: Manager[],
): DashboardStats {
  const totalRevenue = bookings.reduce((sum, b) => sum + b.totalPrice, 0)
  const activeTripsCount = trips.filter((t) =>
    ["booking", "confirmed", "in-progress"].includes(t.status),
  ).length
  const clientIds = new Set(bookings.map((b) => b.clientId))
  const avgOccupancy =
    trips.length > 0
      ? trips.reduce((sum, t) => sum + t.bookedCount / t.capacity, 0) / trips.length
      : 0
  const today = new Date("2026-04-23")
  const in30Days = new Date(today)
  in30Days.setDate(in30Days.getDate() + 30)
  const upcomingDepartures = trips.filter(
    (t) => t.departureDate >= today && t.departureDate <= in30Days,
  ).length

  const monthly = new Map<string, Map<string, number>>()
  for (const b of bookings) {
    const trip = trips.find((t) => t.id === b.tripId)
    if (!trip) continue
    const key = trip.departureDate.toISOString().slice(0, 7)
    if (!monthly.has(key)) monthly.set(key, new Map())
    const mm = monthly.get(key)!
    mm.set(b.managerId, (mm.get(b.managerId) ?? 0) + b.totalPrice)
  }
  const revenueByMonth = [...monthly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, mm]) => {
      const row: { month: string; [key: string]: string | number } = { month }
      for (const mgr of managers) {
        row[mgr.id] = mm.get(mgr.id) ?? 0
      }
      return row
    })

  const hotelCount = new Map<string, number>()
  for (const b of bookings) {
    for (const p of b.passengers) {
      hotelCount.set(p.hotelId, (hotelCount.get(p.hotelId) ?? 0) + 1)
    }
  }
  const maxHotel = Math.max(1, ...hotelCount.values())
  const topHotels = [...hotelCount.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([hotelId, count]) => {
      const h = hotels.find((h) => h.id === hotelId)
      return {
        hotelId,
        name: h?.name ?? hotelId,
        bookingsCount: count,
        percent: Math.round((count / maxHotel) * 100),
      }
    })

  return {
    totalRevenue,
    activeTripsCount,
    totalClients: clientIds.size,
    avgOccupancy: Math.round(avgOccupancy * 100),
    upcomingDepartures,
    revenueByMonth,
    topHotels,
    recentBookings: bookings.slice(0, 5),
  }
}

export interface HotelStats {
  tripsCount: number
  bookingsCount: number
  bookedByType: Partial<Record<RoomType, number>>
  revenue: number
  totalRooms: number
  occupancyPercent: number
}

export function getHotelStats(
  hotelId: string,
  trips: Trip[],
  bookings: Booking[],
  hotels: Hotel[],
): HotelStats {
  const hotel = hotels.find((h) => h.id === hotelId)
  const hotelBookings = bookings.filter((b) => b.passengers.some((p) => p.hotelId === hotelId))
  const tripIds = new Set(trips.filter((t) => t.hotelIds.includes(hotelId)).map((t) => t.id))
  const bookedByType: Partial<Record<RoomType, number>> = {}
  for (const b of hotelBookings) {
    for (const p of b.passengers) {
      if (p.hotelId !== hotelId) continue
      bookedByType[p.roomType] = (bookedByType[p.roomType] ?? 0) + 1
    }
  }
  const revenue = hotelBookings.reduce(
    (sum, b) =>
      sum +
      b.passengers
        .filter((p) => p.hotelId === hotelId)
        .reduce((s, p) => s + p.price, 0),
    0,
  )
  const totalRooms = hotel
    ? hotel.rooms.single.total +
      hotel.rooms.double.total +
      hotel.rooms.triple.total +
      hotel.rooms.family.total
    : 0
  const totalBooked = Object.values(bookedByType).reduce((a, b) => a + (b ?? 0), 0)
  return {
    tripsCount: tripIds.size,
    bookingsCount: hotelBookings.length,
    bookedByType,
    revenue,
    totalRooms,
    occupancyPercent:
      totalRooms > 0 ? Math.min(100, Math.round((totalBooked / totalRooms) * 100)) : 0,
  }
}

export interface ManagerStats {
  tripsCount: number
  bookingsCount: number
  revenue: number
  commission: number
  conversionPercent: number
}

export function getManagerStats(
  managerId: string,
  trips: Trip[],
  bookings: Booking[],
): ManagerStats {
  const mgrTrips = trips.filter((t) => t.managerId === managerId)
  const mgrBookings = bookings.filter((b) => b.managerId === managerId)
  const revenue = mgrBookings.reduce((s, b) => s + b.totalPrice, 0)
  const commission = mgrBookings.reduce((s, b) => s + b.commission, 0)
  const capacity = mgrTrips.reduce((s, t) => s + t.capacity, 0)
  const booked = mgrTrips.reduce((s, t) => s + t.bookedCount, 0)
  return {
    tripsCount: mgrTrips.length,
    bookingsCount: mgrBookings.length,
    revenue,
    commission,
    conversionPercent: capacity > 0 ? Math.round((booked / capacity) * 100) : 0,
  }
}

export interface ClientStats {
  bookingsCount: number
  totalSpend: number
  lastTrip: Trip | null
  upcomingTrip: Trip | null
  preferredHotels: Array<{ hotel: Hotel; count: number }>
}

export function getClientStats(
  clientId: string,
  trips: Trip[],
  bookings: Booking[],
  hotels: Hotel[],
  today: Date = new Date("2026-04-23"),
): ClientStats {
  const clientBookings = bookings.filter((b) => b.clientId === clientId)
  const tripById = new Map(trips.map((t) => [t.id, t]))
  const clientTrips = clientBookings
    .map((b) => tripById.get(b.tripId))
    .filter((t): t is Trip => Boolean(t))
  const sorted = [...clientTrips].sort(
    (a, b) => a.departureDate.getTime() - b.departureDate.getTime(),
  )
  const lastTrip = [...sorted].reverse().find((t) => t.departureDate < today) ?? null
  const upcomingTrip = sorted.find((t) => t.departureDate >= today) ?? null
  const hotelCount = new Map<string, number>()
  for (const b of clientBookings) {
    for (const p of b.passengers) {
      hotelCount.set(p.hotelId, (hotelCount.get(p.hotelId) ?? 0) + 1)
    }
  }
  const preferredHotels = [...hotelCount.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([id, count]) => ({
      hotel: hotels.find((h) => h.id === id)!,
      count,
    }))
    .filter((p) => p.hotel)
  return {
    bookingsCount: clientBookings.length,
    totalSpend: clientBookings.reduce((s, b) => s + b.totalPrice, 0),
    lastTrip,
    upcomingTrip,
    preferredHotels,
  }
}
