import { faker } from "@faker-js/faker"
import type { BusType, Trip, TripStatus } from "@/types"

const ORIGINS = ["Berlin", "München", "Hamburg", "Praha"]
const DESTINATIONS = ["Rimini", "Riccione", "Cattolica", "Bellaria", "Lido di Jesolo", "Caorle"]
const STATUSES: TripStatus[] = ["planned", "booking", "confirmed", "in-progress", "completed"]

export function generateTrips(managerIds: string[], hotelIds: string[]): Trip[] {
  const trips: Trip[] = []
  let id = 1
  for (const origin of ORIGINS) {
    for (const destination of DESTINATIONS) {
      if (id > 20) break
      const busType: BusType = faker.helpers.arrayElement(["55", "79"])
      const capacity = busType === "55" ? 55 : 79
      const departureDate = faker.date.between({ from: "2026-05-01", to: "2026-09-15" })
      const returnDate = new Date(departureDate)
      returnDate.setDate(returnDate.getDate() + faker.number.int({ min: 7, max: 14 }))
      const bookedCount = faker.number.int({ min: 0, max: capacity })
      const status: TripStatus =
        departureDate < new Date("2026-04-23")
          ? "completed"
          : faker.helpers.arrayElement(STATUSES)

      trips.push({
        id: `trip-${id}`,
        name: `${origin} → ${destination}`,
        origin,
        destination,
        departureDate,
        returnDate,
        busType,
        status,
        basePrice: faker.number.int({ min: 450, max: 1200 }),
        managerId: faker.helpers.arrayElement(managerIds),
        hotelIds: faker.helpers.arrayElements(hotelIds, { min: 1, max: 3 }),
        capacity,
        bookedCount,
      })
      id++
    }
  }
  return trips.sort((a, b) => a.departureDate.getTime() - b.departureDate.getTime())
}
