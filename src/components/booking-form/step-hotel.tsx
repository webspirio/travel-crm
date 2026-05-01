import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
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
  const { tripId, hotelId, roomType, noHotel, update } = useBookingStore()
  const { data: trip } = useTripById(tripId ?? undefined)
  const { data: hotels = [] } = useHotels()

  if (!trip) {
    return <p className="text-muted-foreground">{t("validation.pickTrip")}</p>
  }

  const tripHotels = hotels.filter((h) => trip.hotelIds.includes(h.id))

  /** Confirm "no hotel" — clears any previously chosen hotel/room. */
  function handleSkipHotel() {
    update({ noHotel: true, hotelId: null, roomType: null })
  }

  /** Undo skip — operator wants to pick a hotel after all. */
  function handleUndoSkip() {
    update({ noHotel: false })
  }

  if (noHotel) {
    return (
      <div className="space-y-3 rounded-md border border-dashed p-4">
        <p className="text-sm text-muted-foreground">{t("hotel.noHotelConfirmed")}</p>
        <Button variant="outline" size="sm" onClick={handleUndoSkip}>
          {t("hotel.undoSkip")}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {tripHotels.length > 0 && (
        <div className="space-y-2">
          <Label>{t("hotel.pickHotel")}</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {tripHotels.map((h) => {
              const selected = h.id === hotelId
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => update({ hotelId: h.id, noHotel: false })}
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
      )}

      {hotelId && (
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
      )}

      <div className="border-t pt-3">
        <Button variant="ghost" size="sm" onClick={handleSkipHotel}>
          {t("hotel.skipHotel")}
        </Button>
      </div>
    </div>
  )
}
