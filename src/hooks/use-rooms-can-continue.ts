import { useBookingDraft } from "@/lib/booking-draft-context"

/**
 * Returns whether the Rooms step is complete enough to advance.
 *
 * Gates (any of the three conditions must hold for every non-lap passenger):
 *   1. Assigned to a room  (passenger.roomGroupId !== null)
 *   2. Booking-wide skip   (store.noHotel === true)
 *   3. Per-passenger opt-out  (passenger.hotelId === null && passenger.roomType === null
 *                              && passenger.roomGroupId === null)
 *      This is triggered by the "Decline hotel" action in the UI.
 *
 * Additionally, there must be no orphan room cards (rooms with zero non-lap
 * assigned passengers).
 */
export function useRoomsCanContinue(): boolean {
  const passengers = useBookingDraft((s) => s.passengers)
  const rooms = useBookingDraft((s) => s.rooms)
  const noHotel = useBookingDraft((s) => s.noHotel)

  // Booking-wide skip: everyone is implicitly OK
  if (noHotel) return true

  // Lap infants are never counted toward room capacity; they don't need a room.
  const needsRoom = passengers.filter(
    (p) => !(p.kind === "infant" && p.seatNumber === null),
  )

  // Every non-lap passenger must either have a room or have explicitly opted out.
  const allSatisfied = needsRoom.every(
    (p) =>
      p.roomGroupId !== null ||
      (p.hotelId === null && p.roomType === null),
  )

  if (!allSatisfied) return false

  // No orphan room cards (rooms with zero non-lap passengers assigned).
  const hasOrphanRoom = rooms.some((room) => {
    const assigned = passengers.filter(
      (p) =>
        p.roomGroupId === room.localId &&
        !(p.kind === "infant" && p.seatNumber === null),
    )
    return assigned.length === 0
  })

  return !hasOrphanRoom
}
