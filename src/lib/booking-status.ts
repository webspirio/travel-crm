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

// MIRROR of `private.bookings_assert_status_transition` in
// supabase/migrations/20260508900000_domain_rls.sql. The DB enforces
// transitions; this map only governs which buttons render. Keep in sync.
export const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["partially_paid", "paid", "cancelled"],
  partially_paid: ["paid", "cancelled"],
  paid: ["no_show", "cancelled"],
  cancelled: [],
  no_show: [],
}

// Statuses that require a confirmation dialog before applying.
export const DESTRUCTIVE_STATUSES = new Set<BookingStatus>(["cancelled", "no_show"])

/**
 * Sections whose edits require a typed reason once the booking is committed
 * (status >= confirmed). Notes / contact stay frictionless. Sensitive
 * sections that touch money or inventory require a reason.
 */
export type EditableSection =
  | "notes"
  | "contact"
  | "passengers"
  | "hotelsRooms"
  | "pricing"

const SENSITIVE_SECTIONS = new Set<EditableSection>([
  "passengers",
  "hotelsRooms",
  "pricing",
])

export function requiresReason(status: BookingStatus, section: EditableSection): boolean {
  if (!SENSITIVE_SECTIONS.has(section)) return false
  return status === "confirmed" || status === "partially_paid" || status === "paid"
}
