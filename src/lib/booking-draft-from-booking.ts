/**
 * Adapter: saved `Booking` → in-memory `BookingDraft`.
 *
 * Used by the sensitive-edit sheets (T10) to seed an isolated Zustand store
 * from server data. The existing wizard step components read the draft shape;
 * by hydrating into the same shape we can reuse them in edit mode without
 * forking.
 *
 * Mapping notes:
 *  • `localId === passenger.id` so diffs at save time can match draft rows
 *    back to their DB rows.
 *  • Rooms are derived from each passenger's unique `(hotelId, roomType)`
 *    combo — the saved booking has no first-class rooms table, so this is
 *    a best-effort reconstruction. Room pricePerNight uses the hotel's
 *    catalog price for that room type (or 0 when missing).
 *  • Primary contact fields (email/phone/nationality) are not present on
 *    `booking_passengers` rows; they live on `clients`. We leave them blank
 *    in the draft. The passengers + hotels-rooms + pricing edit sheets do
 *    not surface those fields, so the blank values are inert.
 */

import type { BookingDraft, PassengerDraft, RoomDraft } from "@/stores/booking-store"
import type { Booking, Hotel, RoomType } from "@/types"

const EMPTY_PRIMARY_CONTACT = {
  email: "",
  phoneRaw: "",
  phoneE164: null as string | null,
  nationality: null as "UA" | "DE" | null,
  clientId: null as string | null,
  matchIgnored: false,
  promoteToClient: false,
}

export function bookingToDraft(
  booking: Booking,
  hotels: Hotel[],
): BookingDraft {
  const hotelById = new Map(hotels.map((h) => [h.id, h]))

  // ── Build rooms from unique (hotelId, roomType) combos ─────────────────────
  const roomKey = (hotelId: string | null, roomType: RoomType | null): string =>
    `${hotelId ?? "—"}::${roomType ?? "—"}`
  const roomsByKey = new Map<string, RoomDraft>()
  for (const p of booking.passengers) {
    const hotelId = p.hotelId || null
    const roomType = p.roomType || null
    if (!hotelId || !roomType) continue
    const key = roomKey(hotelId, roomType)
    if (roomsByKey.has(key)) continue
    const hotel = hotelById.get(hotelId)
    const ppn = hotel?.rooms[roomType]?.pricePerNight ?? 0
    roomsByKey.set(key, {
      localId: crypto.randomUUID(),
      hotelId,
      roomType,
      pricePerNight: ppn,
    })
  }

  // ── Build passengers ──────────────────────────────────────────────────────
  const passengers: PassengerDraft[] = booking.passengers.map((p, idx) => {
    const hotelId = p.hotelId || null
    const roomType = p.roomType || null
    const key = hotelId && roomType ? roomKey(hotelId, roomType) : null
    const room = key ? roomsByKey.get(key) : undefined
    return {
      // Use the DB id as localId so the diff at save time can match drafts
      // back to their DB rows by identity.
      localId: p.id,
      isPrimary: idx === 0,
      kind: p.kind,
      firstName: p.firstName,
      lastName: p.lastName,
      birthDate: p.birthDate ? toISODate(p.birthDate) : null,
      ...EMPTY_PRIMARY_CONTACT,
      seatNumber: p.seatNumber,
      hotelId,
      roomGroupId: room?.localId ?? null,
      roomType,
      priceEur: p.price,
      priceOverridden: false,
    }
  })

  return {
    step: 0,
    tripId: booking.tripId,
    passengers,
    rooms: [...roomsByKey.values()],
    noHotel: booking.passengers.every((p) => !p.hotelId),
    notes: booking.notes ?? "",
  }
}

/** Local YYYY-MM-DD (matches how the wizard serializes birth dates). */
function toISODate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}
