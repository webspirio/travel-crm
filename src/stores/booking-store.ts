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
  hotelId: string | null
  roomType: RoomType | null
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
