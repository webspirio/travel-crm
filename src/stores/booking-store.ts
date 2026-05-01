import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

import type { RoomType } from "@/types"

export interface BookingDraft {
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
  /** null when no hotel blocks exist or operator explicitly skips hotel. */
  hotelId: string | null
  roomType: RoomType | null
  /**
   * True when the operator has explicitly confirmed "no hotel" for this
   * booking (bus-only trip or unconfigured hotel blocks). Distinguishes the
   * "skip confirmed" state from "not yet chosen" so canContinue unblocks.
   */
  noHotel: boolean
  pricing: {
    basePrice: number
    hotelCost: number
    total: number
    commission: number
  } | null
}

const EMPTY: BookingDraft = {
  step: 0,
  clientId: null,
  tripId: null,
  seatNumber: null,
  hotelId: null,
  roomType: null,
  noHotel: false,
  pricing: null,
}

interface BookingStore extends BookingDraft {
  setStep: (step: number) => void
  update: (patch: Partial<BookingDraft>) => void
  reset: () => void
}

export const useBookingStore = create<BookingStore>()(
  persist(
    (set) => ({
      ...EMPTY,
      setStep: (step) => set({ step }),
      update: (patch) => set((state) => ({ ...state, ...patch })),
      reset: () => set({ ...EMPTY }),
    }),
    {
      name: "anytour-booking-draft",
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
