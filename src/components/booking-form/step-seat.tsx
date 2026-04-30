import { useTranslation } from "react-i18next"

import { SeatMap } from "@/components/bus/seat-map"
import { useTripById } from "@/hooks/queries/use-trips"
import { useBookingStore } from "@/stores/booking-store"

export function StepSeat() {
  const { t } = useTranslation("booking")
  const { tripId, seatNumber, update } = useBookingStore()
  const { data: trip } = useTripById(tripId ?? undefined)

  if (!trip) {
    return (
      <p className="text-muted-foreground">{t("validation.pickTrip")}</p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("seat.pickLabel")}</p>
      <SeatMap
        busType={trip.busType}
        tripId={trip.id}
        selected={seatNumber ? [seatNumber] : []}
        onSelect={(n) => update({ seatNumber: n })}
      />
    </div>
  )
}
