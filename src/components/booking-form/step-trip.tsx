import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useTrips } from "@/hooks/queries/use-trips"
import { formatCurrency, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useBookingStore } from "@/stores/booking-store"
import type { Locale } from "@/types"

export function StepTrip() {
  const { t, i18n } = useTranslation("booking")
  const { t: tt } = useTranslation("trips")
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale
  const { tripId, update } = useBookingStore()
  const { data: trips = [] } = useTrips()

  const available = useMemo(
    () => trips.filter((tr) => tr.bookedCount < tr.capacity && tr.status !== "cancelled"),
    [trips],
  )

  return (
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
              onClick={() => update({ tripId: tr.id, seatNumber: null, hotelId: null })}
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
  )
}
