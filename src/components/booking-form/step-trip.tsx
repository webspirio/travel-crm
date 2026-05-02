import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useTrips } from "@/hooks/queries/use-trips"
import { formatCurrency, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useBookingDraft } from "@/lib/booking-draft-context"
import type { Locale } from "@/types"

export function StepTrip() {
  const { t, i18n } = useTranslation("booking")
  const { t: tt } = useTranslation("trips")
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale

  const tripId = useBookingDraft((s) => s.tripId)
  const passengers = useBookingDraft((s) => s.passengers)
  const rooms = useBookingDraft((s) => s.rooms)
  const update = useBookingDraft((s) => s.update)
  const updatePassenger = useBookingDraft((s) => s.updatePassenger)

  const { data: trips = [] } = useTrips()

  // State for the "trip change will reset assignments" confirm dialog.
  const [pendingTripId, setPendingTripId] = useState<string | null>(null)

  const available = useMemo(
    () => trips.filter((tr) => tr.bookedCount < tr.capacity && tr.status !== "cancelled"),
    [trips],
  )

  /** Number of seat assignments + rooms that would be wiped on trip change. */
  const assignmentCount = useMemo(() => {
    const seats = passengers.filter((p) => p.seatNumber !== null).length
    return seats + rooms.length
  }, [passengers, rooms])

  const applyTripChange = (newTripId: string) => {
    // Reset all seat numbers + hotel assignments on every passenger.
    for (const p of passengers) {
      updatePassenger(p.localId, {
        seatNumber: null,
        hotelId: null,
        roomGroupId: null,
        roomType: null,
      })
    }
    // Wipe rooms array and update tripId.
    update({ tripId: newTripId, rooms: [] })
  }

  const handleSelect = (newTripId: string) => {
    if (newTripId === tripId) return

    if (assignmentCount > 0) {
      // Show confirm dialog before wiping assignments.
      setPendingTripId(newTripId)
      return
    }

    applyTripChange(newTripId)
  }

  const handleConfirmChange = () => {
    if (pendingTripId) {
      applyTripChange(pendingTripId)
    }
    setPendingTripId(null)
  }

  return (
    <>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("trip.pickLabel")}</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {available.map((tr) => {
            const isSelected = tr.id === tripId
            const free = tr.capacity - tr.bookedCount
            const percent = Math.round((tr.bookedCount / tr.capacity) * 100)
            return (
              <button
                key={tr.id}
                type="button"
                onClick={() => handleSelect(tr.id)}
                className="text-left"
              >
                <Card
                  className={cn(
                    "transition-colors",
                    isSelected && "border-primary ring-2 ring-primary/30",
                  )}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2 text-base">
                      {tr.name}
                      <Badge variant="outline">{formatCurrency(tr.basePrice, locale)}</Badge>
                    </CardTitle>
                    <CardDescription>
                      {formatDate(tr.departureDate, locale)} · {tt(`bus.${tr.busType}`)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>
                        {free > 0 ? `${free} ${t("trip.available")}` : t("trip.full")}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{percent}%</span>
                    </div>
                    <Progress value={percent} />
                  </CardContent>
                </Card>
              </button>
            )
          })}
        </div>
      </div>

      {/* Trip-change confirmation dialog */}
      <Dialog open={pendingTripId !== null} onOpenChange={(open) => { if (!open) setPendingTripId(null) }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("trip.changeConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("travelers.tripChangeConfirm", { count: assignmentCount })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingTripId(null)}>
              {t("trip.changeCancel")}
            </Button>
            <Button variant="destructive" onClick={handleConfirmChange}>
              {t("trip.changeConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
