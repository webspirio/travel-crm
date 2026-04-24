import { faker } from "@faker-js/faker"
import type { Booking, Client, Hotel, Passenger, RoomType, Trip } from "@/types"

const GROUP_WEIGHTS: Array<{ size: number; weight: number }> = [
  { size: 1, weight: 5 },
  { size: 2, weight: 4 },
  { size: 3, weight: 2 },
  { size: 4, weight: 1 },
]

function pickGroupSize(maxSeats: number): number {
  const pool = GROUP_WEIGHTS.filter((g) => g.size <= maxSeats)
  const total = pool.reduce((s, g) => s + g.weight, 0)
  let r = faker.number.float({ min: 0, max: total })
  for (const g of pool) {
    r -= g.weight
    if (r <= 0) return g.size
  }
  return 1
}

function roomForGroup(size: number): RoomType {
  if (size >= 4) return "family"
  if (size === 3) return "triple"
  if (size === 2) return "double"
  return faker.helpers.arrayElement<RoomType>(["single", "double"])
}

export function generateBookings(trips: Trip[], clients: Client[], hotels: Hotel[]): Booking[] {
  const bookings: Booking[] = []
  let bookingIdSeq = 1
  let passengerIdSeq = 1
  let contractSeq = 26001

  for (const trip of trips) {
    const tripHotels = hotels.filter((h) => trip.hotelIds.includes(h.id))
    if (tripHotels.length === 0) continue

    const target = Math.min(trip.bookedCount, trip.capacity)
    const seatsAvailable = new Set<number>(
      Array.from({ length: trip.capacity }, (_, i) => i + 1),
    )
    let seatsPlaced = 0

    while (seatsPlaced < target && seatsAvailable.size > 0) {
      const remaining = target - seatsPlaced
      const size = Math.min(pickGroupSize(remaining), remaining, seatsAvailable.size)

      const client = faker.helpers.arrayElement(clients)
      const hotel = faker.helpers.arrayElement(tripHotels)
      const roomType = roomForGroup(size)
      const nights = Math.round(
        (trip.returnDate.getTime() - trip.departureDate.getTime()) / (1000 * 60 * 60 * 24),
      )
      const hotelCost = hotel.rooms[roomType].pricePerNight * nights

      const passengers: Passenger[] = []
      let totalPrice = 0
      for (let i = 0; i < size; i++) {
        const seatArr = Array.from(seatsAvailable)
        const seat = seatArr[faker.number.int({ min: 0, max: seatArr.length - 1 })]
        seatsAvailable.delete(seat)

        const isFirstRow = seat <= 12
        const extraFee = isFirstRow ? 25 : undefined
        const perPaxHotel = Math.round(hotelCost / size)
        const price = trip.basePrice + perPaxHotel + (extraFee ?? 0)
        totalPrice += price

        const first =
          i === 0
            ? client.firstName
            : faker.person.firstName(faker.helpers.arrayElement(["male", "female"]))
        const last = i === 0 ? client.lastName : client.lastName
        passengers.push({
          id: `px-${passengerIdSeq++}`,
          firstName: first,
          lastName: last,
          seatNumber: seat,
          hotelId: hotel.id,
          roomType,
          price,
          extraFee,
        })
      }

      const status: Booking["status"] = faker.helpers.arrayElement([
        "confirmed",
        "paid",
        "confirmed",
        "paid",
        "draft",
      ])
      const paidAmount =
        status === "paid"
          ? totalPrice
          : status === "confirmed"
            ? Math.round(totalPrice * faker.number.float({ min: 0.3, max: 0.7 }))
            : 0
      const dueDate = new Date(trip.departureDate)
      dueDate.setDate(dueDate.getDate() - 14)

      bookings.push({
        id: `bk-${bookingIdSeq++}`,
        contractNumber: String(contractSeq++),
        clientId: client.id,
        tripId: trip.id,
        passengers,
        totalPrice,
        paidAmount,
        dueDate,
        commission: Math.round(totalPrice * 0.1),
        status,
        managerId: trip.managerId,
        createdAt: faker.date.between({ from: "2026-01-01", to: "2026-04-20" }),
      })

      seatsPlaced += size
    }
  }

  return bookings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}
