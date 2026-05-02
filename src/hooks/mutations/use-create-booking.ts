import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { UseMutationResult } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { requireTenant } from "@/lib/auth-guard"
import { bookingsKeys } from "@/hooks/queries/use-bookings"
import { clientsKeys } from "@/hooks/queries/use-clients"
import { tripsKeys, tripOccupancyKeys } from "@/hooks/queries/use-trips"
import { tripSeatsKeys } from "@/hooks/queries/use-trip-seats"
import type { BookingDraft } from "@/stores/booking-store"

export interface CreateBookingInput {
  /** Snapshot of the booking-store state (new multi-passenger shape). */
  draft: BookingDraft
}

export interface CreateBookingResult {
  bookingId: string
  bookingNumber: string
}

/**
 * Persists a new multi-passenger booking via the `create_booking_with_passengers`
 * RPC. The RPC runs inside a single transaction and resolves the manager id
 * server-side, so no managerId is required from the client.
 *
 * On success: invalidates bookings, trip detail, trip-seats, trip-occupancy, and
 * (when any new client was created as part of the booking) clients caches.
 *
 * Error handling is left to the caller — wrap with translatePgError + toast.
 */
export function useCreateBooking(): UseMutationResult<
  CreateBookingResult,
  Error,
  CreateBookingInput
> {
  const queryClient = useQueryClient()

  return useMutation<CreateBookingResult, Error, CreateBookingInput>({
    mutationFn: async ({ draft }) => {
      const { tenantId } = requireTenant()

      if (!draft.tripId) throw new Error("No trip selected.")

      const primary = draft.passengers[0]
      if (!primary) throw new Error("No primary passenger.")

      const payload = {
        tenantId,
        tripId: draft.tripId,
        notes: draft.notes ?? null,
        primaryClientId: primary.clientId ?? null,
        // Only send `primary` block when we are creating a new clients row.
        primary: primary.clientId
          ? null
          : {
              firstName: primary.firstName,
              lastName: primary.lastName,
              email: primary.email || null,
              phone: primary.phoneE164 || primary.phoneRaw || null,
              nationality: primary.nationality,
              birthDate: primary.birthDate,
            },
        passengers: draft.passengers.map((p) => ({
          kind: p.kind,
          firstName: p.firstName,
          lastName: p.lastName,
          birthDate: p.birthDate,
          seatNumber: p.seatNumber,
          hotelId: p.hotelId,
          roomType: p.roomType,
          priceEur: p.priceEur,
          priceBreakdown: {},
          clientId: p.clientId,
        })),
      }

      const { data, error } = await supabase.rpc("create_booking_with_passengers", {
        _payload: payload,
      })
      if (error) throw error

      const row = (data as Array<{ booking_id: string; booking_number: string }> | null)?.[0]
      if (!row) throw new Error("rpc returned no row")
      return { bookingId: row.booking_id, bookingNumber: row.booking_number }
    },

    onSuccess: (_result, { draft }) => {
      void queryClient.invalidateQueries({ queryKey: bookingsKeys.all })

      if (draft.tripId) {
        void queryClient.invalidateQueries({ queryKey: tripsKeys.detail(draft.tripId) })
        void queryClient.invalidateQueries({ queryKey: tripSeatsKeys.byTrip(draft.tripId) })
        void queryClient.invalidateQueries({ queryKey: tripOccupancyKeys.byTrip(draft.tripId) })
      }

      // Invalidate clients only when we created or promoted any client(s).
      const createdAny = draft.passengers.some(
        (p) => !p.clientId && (p.email || p.phoneE164 || p.firstName),
      )
      if (createdAny) {
        void queryClient.invalidateQueries({ queryKey: clientsKeys.all })
      }
    },
  })
}
