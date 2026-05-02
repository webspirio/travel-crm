import type { VariantProps } from "class-variance-authority"

import { badgeVariants } from "@/components/ui/badge"
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

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

/** Canonical badge variant for a booking status. Use in every view. */
export function bookingStatusVariant(s: BookingStatus): BadgeVariant {
  switch (s) {
    case "draft":
      return "outline"
    case "confirmed":
      return "secondary"
    case "partially_paid":
      return "secondary"
    case "paid":
      return "default"
    case "cancelled":
      return "destructive"
    case "no_show":
      return "destructive"
  }
}
