import type { Booking, DashboardStats, Hotel, Manager, Trip } from "@/types"

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
    hotelCount.set(b.hotelId, (hotelCount.get(b.hotelId) ?? 0) + 1)
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
