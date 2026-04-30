import { useTranslation } from "react-i18next"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useHotels } from "@/hooks/queries/use-hotels"
import { useTripById } from "@/hooks/queries/use-trips"
import { cn } from "@/lib/utils"
import { useBookingStore } from "@/stores/booking-store"
import type { RoomType } from "@/types"

const ROOM_TYPES: RoomType[] = ["single", "double", "triple", "family"]

export function StepHotel() {
  const { t } = useTranslation("booking")
  const { t: tc } = useTranslation()
  const { tripId, hotelId, roomType, update } = useBookingStore()
  const { data: trip } = useTripById(tripId ?? undefined)
  const { data: hotels = [] } = useHotels()

  if (!trip) {
    return <p className="text-muted-foreground">{t("validation.pickTrip")}</p>
  }

  const tripHotels = hotels.filter((h) => trip.hotelIds.includes(h.id))

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t("hotel.pickHotel")}</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {tripHotels.map((h) => {
            const selected = h.id === hotelId
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => update({ hotelId: h.id })}
                className={cn(
                  "flex flex-col rounded-md border p-3 text-left transition-colors",
                  selected ? "border-primary bg-accent" : "hover:bg-accent/50",
                )}
              >
                <span className="font-medium">{h.name}</span>
                <span className="text-sm text-muted-foreground">
                  {h.city} · {"★".repeat(h.stars)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("hotel.pickRoom")}</Label>
        <RadioGroup
          value={roomType ?? ""}
          onValueChange={(v) => {
            if (v) update({ roomType: v as RoomType })
          }}
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {ROOM_TYPES.map((rt) => (
            <label
              key={rt}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm transition-colors",
                roomType === rt ? "border-primary bg-accent" : "hover:bg-accent/50",
              )}
            >
              <RadioGroupItem value={rt} />
              <span>{tc(`room.${rt}`)}</span>
            </label>
          ))}
        </RadioGroup>
      </div>
    </div>
  )
}
