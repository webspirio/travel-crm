import { useBookingStore } from "@/stores/booking-store"

/**
 * Returns whether the Seats step is complete enough to advance.
 *
 * Gate: every non-lap-infant passenger has a seatNumber assigned.
 * Lap-infants (kind === "infant" with seatNumber === null) are exempt.
 *
 * If there are no seatable passengers (e.g. all infants), returns true so
 * the wizard can advance without being blocked.
 */
export function useSeatsCanContinue(): boolean {
  const passengers = useBookingStore((s) => s.passengers)

  const seatable = passengers.filter(
    (p) => !(p.kind === "infant" && p.seatNumber === null),
  )

  if (seatable.length === 0) return true

  return seatable.every((p) => p.seatNumber !== null)
}
