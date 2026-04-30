import type { Database } from "@/types/database"

export type BookingStatus = Database["public"]["Enums"]["booking_status"]

// Statuses where a booking is committed enough that its passengers
// occupy seats on the trip. Cancelled / no_show bookings free their
// seats; draft bookings are reservations-in-progress that don't yet
// hold seats either.
export const OCCUPYING_STATUSES = new Set<BookingStatus>([
  "confirmed",
  "partially_paid",
  "paid",
])

export function isOccupying(status: BookingStatus): boolean {
  return OCCUPYING_STATUSES.has(status)
}
