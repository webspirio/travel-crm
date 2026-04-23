import { faker, fakerDE, fakerUK } from "@faker-js/faker"

faker.seed(42)
fakerDE.seed(42)
fakerUK.seed(42)
const REF_DATE = new Date("2026-06-01")
faker.setDefaultRefDate(REF_DATE)
fakerDE.setDefaultRefDate(REF_DATE)
fakerUK.setDefaultRefDate(REF_DATE)

import { managers } from "./managers"
import { generateHotels } from "./hotels"
import { generateClients } from "./clients"
import { generateTrips } from "./trips"
import { generateBookings } from "./bookings"
import { computeStats } from "./stats"

export const hotels = generateHotels()
export const clients = generateClients()
export const trips = generateTrips(
  managers.map((m) => m.id),
  hotels.map((h) => h.id),
)
export const bookings = generateBookings(trips, clients, hotels)
export const stats = computeStats(trips, bookings, hotels, managers)

export { managers }
