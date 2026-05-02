import type { PassengerKind, Trip } from "@/types"

/**
 * Default per-passenger trip cost based on kind.
 *
 * Falls back to basePrice when childPrice is missing (treat as the
 * adult fare); infants without an explicit infantPrice are free
 * (lap-infant default).
 */
export function defaultPriceFor(
  trip: Pick<Trip, "basePrice" | "childPrice" | "infantPrice"> | null,
  kind: PassengerKind,
): number {
  if (!trip) return 0
  switch (kind) {
    case "adult":
      return trip.basePrice
    case "child":
      return trip.childPrice ?? trip.basePrice
    case "infant":
      return trip.infantPrice ?? 0
  }
}

/**
 * Infer passenger kind from a birth-date string (ISO yyyy-mm-dd).
 *
 * Boundaries follow the conventional bus-tour pricing brackets:
 *   • < 2 years → infant
 *   • < 12 years → child
 *   • otherwise → adult
 *
 * Invalid / missing input falls back to "adult" so the UI never
 * silently flips a row to a free fare on a typo.
 */
export function inferKindFromBirthDate(
  birthDate: string | null,
  referenceDate: Date = new Date(),
): PassengerKind {
  if (!birthDate) return "adult"
  const dob = new Date(birthDate)
  if (Number.isNaN(dob.getTime())) return "adult"
  const ageMs = referenceDate.getTime() - dob.getTime()
  const ageYears = ageMs / (365.25 * 24 * 3600 * 1000)
  if (ageYears < 2) return "infant"
  if (ageYears < 12) return "child"
  return "adult"
}
