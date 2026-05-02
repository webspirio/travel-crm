import type { TFunction } from "i18next"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/format"
import type { Locale, Manager, Trip } from "@/types"

interface Props {
  trip: Trip | null | undefined
  manager: Manager | undefined
  t: TFunction<"booking">
  locale: Locale
}

/**
 * Trip section — trip name, departure & return dates, route origin →
 * destination, and the manager who sold the booking. Read-only.
 */
export function TripCard({ trip, manager, t, locale }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("detail.sections.trip")}</CardTitle>
      </CardHeader>
      <CardContent>
        {!trip ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-base font-medium">{trip.name}</p>
            <dl className="grid grid-cols-[140px_1fr] gap-y-2">
              <dt className="text-muted-foreground">{t("detail.trip.departure")}</dt>
              <dd className="tabular-nums">{formatDate(trip.departureDate, locale)}</dd>

              <dt className="text-muted-foreground">{t("detail.trip.return")}</dt>
              <dd className="tabular-nums">{formatDate(trip.returnDate, locale)}</dd>

              <dt className="text-muted-foreground">{t("detail.trip.route")}</dt>
              <dd>
                {trip.origin} → {trip.destination}
              </dd>

              {manager && (
                <>
                  <dt className="text-muted-foreground">{t("detail.trip.soldBy")}</dt>
                  <dd>{manager.name}</dd>
                </>
              )}
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
