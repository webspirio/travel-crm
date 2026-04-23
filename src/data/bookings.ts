import { faker } from "@faker-js/faker"
import type { Booking, Client, Hotel, RoomType, Trip } from "@/types"

const ROOM_TYPES: RoomType[] = ["single", "double", "triple", "family"]

export function generateBookings(trips: Trip[], clients: Client[], hotels: Hotel[]): Booking[] {
  const bookings: Booking[] = []
  let id = 1

  for (const trip of trips) {
    const tripHotels = hotels.filter((h) => trip.hotelIds.includes(h.id))
    if (tripHotels.length === 0) continue
    const seatNumbers = new Set<number>()
    const count = Math.min(trip.bookedCount, trip.capacity)

    for (let i = 0; i < count; i++) {
      let seat = faker.number.int({ min: 1, max: trip.capacity })
      while (seatNumbers.has(seat)) seat = faker.number.int({ min: 1, max: trip.capacity })
      seatNumbers.add(seat)

      const client = faker.helpers.arrayElement(clients)
      const hotel = faker.helpers.arrayElement(tripHotels)
      const roomType = faker.helpers.arrayElement(ROOM_TYPES)
      const nights = Math.round(
        (trip.returnDate.getTime() - trip.departureDate.getTime()) / (1000 * 60 * 60 * 24),
      )
      const hotelCost = hotel.rooms[roomType].pricePerNight * nights
      const totalPrice = trip.basePrice + hotelCost

      bookings.push({
        id: `bk-${id++}`,
        clientId: client.id,
        tripId: trip.id,
        seatNumber: seat,
        hotelId: hotel.id,
        roomType,
        totalPrice,
        commission: Math.round(totalPrice * 0.1),
        status: faker.helpers.arrayElement(["confirmed", "paid", "confirmed", "paid", "draft"]),
        managerId: trip.managerId,
        createdAt: faker.date.between({ from: "2026-01-01", to: "2026-04-20" }),
      })
    }
  }

  return bookings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}
