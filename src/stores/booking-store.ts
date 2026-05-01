import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

import type { PassengerKind, RoomType } from "@/types"

// ─── Core draft shapes ────────────────────────────────────────────────────────

export interface PassengerDraft {
  localId: string
  isPrimary: boolean
  kind: PassengerKind
  firstName: string
  lastName: string
  birthDate: string | null
  // Primary-only fields (kept on every draft for symmetry; ignored when !isPrimary):
  email: string
  phoneRaw: string
  phoneE164: string | null
  nationality: "UA" | "DE" | null
  // Match resolution:
  clientId: string | null
  matchIgnored: boolean
  promoteToClient: boolean
  // Allocation:
  seatNumber: number | null
  hotelId: string | null
  roomGroupId: string | null
  roomType: RoomType | null
  priceEur: number
  priceOverridden: boolean
}

export interface RoomDraft {
  localId: string
  hotelId: string
  roomType: RoomType
  pricePerNight: number
}

export interface BookingDraft {
  step: number
  tripId: string | null
  passengers: PassengerDraft[]
  rooms: RoomDraft[]
  noHotel: boolean
  notes: string
}

// ─── Store actions ─────────────────────────────────────────────────────────────

interface BookingStore extends BookingDraft {
  // Step navigation
  setStep: (step: number) => void

  // Passenger CRUD
  addPassenger: (kind: PassengerKind) => void
  removePassenger: (localId: string) => void
  updatePassenger: (localId: string, patch: Partial<PassengerDraft>) => void
  reorderPassengers: (localIds: string[]) => void
  setPrimary: (localId: string) => void

  // Room CRUD
  addRoom: (hotelId: string, roomType: RoomType, pricePerNight: number) => string
  removeRoom: (localId: string) => void
  assignToRoom: (passengerLocalId: string, roomLocalId: string | null) => void

  // Misc
  reset: () => void
  update: (patch: Partial<BookingDraft>) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEmptyPrimary(): PassengerDraft {
  return {
    localId: crypto.randomUUID(),
    isPrimary: true,
    kind: "adult",
    firstName: "",
    lastName: "",
    birthDate: null,
    email: "",
    phoneRaw: "",
    phoneE164: null,
    nationality: null,
    clientId: null,
    matchIgnored: false,
    promoteToClient: false,
    seatNumber: null,
    hotelId: null,
    roomGroupId: null,
    roomType: null,
    priceEur: 0,
    priceOverridden: false,
  }
}

const EMPTY: BookingDraft = {
  step: 0,
  tripId: null,
  passengers: [],
  rooms: [],
  noHotel: false,
  notes: "",
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBookingStore = create<BookingStore>()(
  persist(
    (set) => ({
      ...EMPTY,
      passengers: [makeEmptyPrimary()],

      // Step navigation
      setStep: (step) => set({ step }),

      // Passenger CRUD
      addPassenger: (kind) =>
        set((state) => ({
          passengers: [
            ...state.passengers,
            {
              localId: crypto.randomUUID(),
              isPrimary: false,
              kind,
              firstName: "",
              lastName: "",
              birthDate: null,
              email: "",
              phoneRaw: "",
              phoneE164: null,
              nationality: null,
              clientId: null,
              matchIgnored: false,
              promoteToClient: false,
              seatNumber: null,
              hotelId: null,
              roomGroupId: null,
              roomType: null,
              priceEur: 0,
              priceOverridden: false,
            },
          ],
        })),

      removePassenger: (localId) =>
        set((state) => {
          const target = state.passengers.find((p) => p.localId === localId)
          if (!target || target.isPrimary) {
            console.warn("removePassenger: cannot remove primary passenger or unknown id", localId)
            return state
          }
          return { passengers: state.passengers.filter((p) => p.localId !== localId) }
        }),

      updatePassenger: (localId, patch) =>
        set((state) => ({
          passengers: state.passengers.map((p) =>
            p.localId === localId ? { ...p, ...patch } : p,
          ),
        })),

      reorderPassengers: (localIds) =>
        set((state) => {
          const currentIds = new Set(state.passengers.map((p) => p.localId))
          const newIds = new Set(localIds)
          if (
            currentIds.size !== newIds.size ||
            [...currentIds].some((id) => !newIds.has(id))
          ) {
            console.warn("reorderPassengers: localIds set does not match current passengers")
            return state
          }
          const ordered = localIds.map((id) => state.passengers.find((p) => p.localId === id)!)
          // Ensure passengers[0] is always primary
          const withFlags = ordered.map((p, i) => ({ ...p, isPrimary: i === 0 }))
          return { passengers: withFlags }
        }),

      setPrimary: (localId) =>
        set((state) => {
          const idx = state.passengers.findIndex((p) => p.localId === localId)
          if (idx === -1) {
            console.warn("setPrimary: passenger not found", localId)
            return state
          }
          const reordered = [
            state.passengers[idx],
            ...state.passengers.slice(0, idx),
            ...state.passengers.slice(idx + 1),
          ]
          const withFlags = reordered.map((p, i) => ({ ...p, isPrimary: i === 0 }))
          return { passengers: withFlags }
        }),

      // Room CRUD
      addRoom: (hotelId, roomType, pricePerNight) => {
        const localId = crypto.randomUUID()
        set((state) => ({
          rooms: [...state.rooms, { localId, hotelId, roomType, pricePerNight }],
        }))
        return localId
      },

      removeRoom: (localId) =>
        set((state) => ({
          rooms: state.rooms.filter((r) => r.localId !== localId),
        })),

      assignToRoom: (passengerLocalId, roomLocalId) =>
        set((state) => {
          const room = roomLocalId ? state.rooms.find((r) => r.localId === roomLocalId) : null
          return {
            passengers: state.passengers.map((p) =>
              p.localId === passengerLocalId
                ? {
                    ...p,
                    roomGroupId: roomLocalId,
                    hotelId: room?.hotelId ?? null,
                    roomType: room?.roomType ?? null,
                  }
                : p,
            ),
          }
        }),

      // Misc
      reset: () =>
        set({
          ...EMPTY,
          passengers: [makeEmptyPrimary()],
        }),

      update: (patch) => set((state) => ({ ...state, ...patch })),
    }),
    {
      name: "anytour-booking-draft",
      version: 2,
      migrate: (persisted: unknown, fromVersion: number) => {
        if (fromVersion < 2) {
          const p = persisted as Record<string, unknown> | null | undefined
          try {
            const nc = p?.newClient as Record<string, unknown> | undefined
            const pricingRaw = p?.pricing as Record<string, unknown> | undefined
            const primary: PassengerDraft = {
              localId: crypto.randomUUID(),
              isPrimary: true,
              kind: "adult",
              firstName: typeof nc?.firstName === "string" ? nc.firstName : "",
              lastName: typeof nc?.lastName === "string" ? nc.lastName : "",
              birthDate: null,
              email: typeof nc?.email === "string" ? nc.email : "",
              phoneRaw: typeof nc?.phone === "string" ? nc.phone : "",
              phoneE164: null,
              nationality:
                nc?.nationality === "UA" || nc?.nationality === "DE" ? nc.nationality : null,
              clientId: typeof p?.clientId === "string" ? p.clientId : null,
              matchIgnored: false,
              promoteToClient: false,
              seatNumber: typeof p?.seatNumber === "number" ? p.seatNumber : null,
              hotelId: typeof p?.hotelId === "string" ? p.hotelId : null,
              roomGroupId: null,
              roomType: typeof p?.roomType === "string" ? (p.roomType as RoomType) : null,
              priceEur: typeof pricingRaw?.total === "number" ? pricingRaw.total : 0,
              priceOverridden: false,
            }
            const rooms: RoomDraft[] =
              typeof p?.hotelId === "string" && typeof p?.roomType === "string"
                ? [
                    {
                      localId: crypto.randomUUID(),
                      hotelId: p.hotelId,
                      roomType: p.roomType as RoomType,
                      pricePerNight: 0,
                    },
                  ]
                : []
            if (rooms.length === 1) primary.roomGroupId = rooms[0].localId
            return {
              ...EMPTY,
              passengers: [primary],
              tripId: typeof p?.tripId === "string" ? p.tripId : null,
              rooms,
              noHotel: !!p?.noHotel,
            }
          } catch {
            localStorage.setItem("anytour-booking-draft-reset-toast", "1")
            return { ...EMPTY, passengers: [makeEmptyPrimary()] }
          }
        }
        return persisted as BookingDraft
      },
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

// ─── Compatibility layer ──────────────────────────────────────────────────────
//
// @deprecated These types and the useLegacyBookingDraft selector exist solely
// so the legacy step-* components and use-create-booking.ts continue to compile
// until they are rewritten in Tasks 5-9. Do NOT use in new code.

export interface LegacyBookingDraft {
  step: number
  clientId: string | null
  newClient?: {
    firstName: string
    lastName: string
    email: string
    phone: string
    nationality: "UA" | "DE"
  }
  tripId: string | null
  seatNumber: number | null
  hotelId: string | null
  roomType: RoomType | null
  noHotel: boolean
  pricing: {
    basePrice: number
    hotelCost: number
    total: number
    commission: number
  } | null
}

/**
 * @deprecated Compatibility selector — derives legacy flat view from the new
 * multi-passenger store so the legacy step-* components continue to compile
 * until they are rewritten in Tasks 6-9. Do NOT use in new code.
 */
export function useLegacyBookingDraft(): LegacyBookingDraft & {
  update: (patch: Partial<LegacyBookingDraft>) => void
  setStep: (step: number) => void
  reset: () => void
} {
  const store = useBookingStore()
  const primary = store.passengers[0] ?? makeEmptyPrimary()

  const legacy: LegacyBookingDraft = {
    step: store.step,
    clientId: primary.clientId,
    newClient:
      !primary.clientId &&
      (primary.firstName || primary.lastName || primary.email)
        ? {
            firstName: primary.firstName,
            lastName: primary.lastName,
            email: primary.email,
            phone: primary.phoneRaw,
            nationality: primary.nationality ?? "UA",
          }
        : undefined,
    tripId: store.tripId,
    seatNumber: primary.seatNumber,
    hotelId: primary.hotelId,
    roomType: primary.roomType,
    noHotel: store.noHotel,
    pricing: null, // pricing is computed in StepPricing and passed back via update
  }

  const update = (patch: Partial<LegacyBookingDraft>) => {
    // Map legacy flat-patch back to the new store shape
    if (patch.step !== undefined) store.setStep(patch.step)
    if (patch.noHotel !== undefined || patch.tripId !== undefined) {
      store.update({
        ...(patch.tripId !== undefined ? { tripId: patch.tripId } : {}),
        ...(patch.noHotel !== undefined ? { noHotel: patch.noHotel } : {}),
      })
    }

    // Passenger-level fields go to the primary passenger
    const passengerPatch: Partial<PassengerDraft> = {}
    if (patch.clientId !== undefined) passengerPatch.clientId = patch.clientId
    if (patch.seatNumber !== undefined) passengerPatch.seatNumber = patch.seatNumber
    if (patch.hotelId !== undefined) passengerPatch.hotelId = patch.hotelId
    if (patch.roomType !== undefined) passengerPatch.roomType = patch.roomType

    if (patch.newClient !== undefined) {
      if (patch.newClient === null) {
        // Clearing new-client
        passengerPatch.firstName = ""
        passengerPatch.lastName = ""
        passengerPatch.email = ""
        passengerPatch.phoneRaw = ""
        passengerPatch.nationality = null
      } else {
        passengerPatch.firstName = patch.newClient.firstName
        passengerPatch.lastName = patch.newClient.lastName
        passengerPatch.email = patch.newClient.email
        passengerPatch.phoneRaw = patch.newClient.phone
        passengerPatch.nationality = patch.newClient.nationality
      }
      if (patch.clientId === null || (patch.clientId === undefined && patch.newClient)) {
        passengerPatch.clientId = null
      }
    }

    if (Object.keys(passengerPatch).length > 0) {
      store.updatePassenger(primary.localId, passengerPatch)
    }

    // pricing is stored separately — the legacy step-pricing component calls
    // update({ pricing }) and we just need to not crash; pricing is recomputed
    // in StepPricing so we don't store it on the new shape at all.
  }

  return {
    ...legacy,
    update,
    setStep: store.setStep,
    reset: store.reset,
  }
}
