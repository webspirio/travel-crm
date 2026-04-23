import { faker } from "@faker-js/faker"
import type { Hotel } from "@/types"

const HOTEL_NAMES = [
  { name: "Hotel Bellavista", city: "Rimini", stars: 4 },
  { name: "Grand Hotel Adriatico", city: "Rimini", stars: 5 },
  { name: "Residence Mare Blu", city: "Riccione", stars: 3 },
  { name: "Hotel Sole & Luna", city: "Riccione", stars: 4 },
  { name: "Hotel Costa Verde", city: "Cattolica", stars: 4 },
  { name: "Villa Ester", city: "Cattolica", stars: 3 },
  { name: "Hotel San Marco", city: "Bellaria", stars: 4 },
  { name: "Palace Hotel Venezia", city: "Lido di Jesolo", stars: 5 },
  { name: "Hotel Riviera", city: "Lido di Jesolo", stars: 4 },
  { name: "Hotel Azzurro", city: "Caorle", stars: 3 },
] as const

export function generateHotels(): Hotel[] {
  return HOTEL_NAMES.map((h, i) => ({
    id: `hotel-${i + 1}`,
    name: h.name,
    city: h.city,
    country: "Italy",
    stars: h.stars as 3 | 4 | 5,
    rooms: {
      single: { total: faker.number.int({ min: 4, max: 10 }), pricePerNight: 65 + h.stars * 20 },
      double: { total: faker.number.int({ min: 20, max: 40 }), pricePerNight: 90 + h.stars * 25 },
      triple: { total: faker.number.int({ min: 8, max: 16 }), pricePerNight: 120 + h.stars * 30 },
      family: { total: faker.number.int({ min: 4, max: 10 }), pricePerNight: 160 + h.stars * 35 },
    },
  }))
}
