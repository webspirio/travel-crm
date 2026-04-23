import { useTranslation } from "react-i18next"

import { SeatMap } from "@/components/bus/seat-map"
import { trips } from "@/data"
import { useBookingStore } from "@/stores/booking-store"

export function StepSeat() {
  const { t } = useTranslation("booking")
  const { tripId, seatNumber, update } = useBookingStore()
  const trip = trips.find((tr) => tr.id === tripId)

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
