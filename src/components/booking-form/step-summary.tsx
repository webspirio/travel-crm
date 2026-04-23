import { useTranslation } from "react-i18next"

import { clients, hotels, trips } from "@/data"
import { formatCurrency, formatDateRange } from "@/lib/format"
import { useBookingStore } from "@/stores/booking-store"
import type { Locale } from "@/types"

export function StepSummary() {
  const { t, i18n } = useTranslation("booking")
  const { t: tc } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale
  const { clientId, newClient, tripId, seatNumber, hotelId, roomType, pricing } =
    useBookingStore()

  const client = clients.find((c) => c.id === clientId)
  const trip = trips.find((tr) => tr.id === tripId)
  const hotel = hotels.find((h) => h.id === hotelId)

  const clientLabel = client
    ? `${client.firstName} ${client.lastName} · ${client.email}`
    : newClient
      ? `${newClient.firstName} ${newClient.lastName} · ${newClient.email} (new)`
      : "—"

  return (
    <div className="space-y-3 rounded-md border p-4">
      <h3 className="text-lg font-semibold">{t("summary.title")}</h3>
      <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-[160px_1fr]">
        <dt className="text-muted-foreground">{t("steps.client")}</dt>
        <dd>{clientLabel}</dd>
        <dt className="text-muted-foreground">{t("steps.trip")}</dt>
        <dd>
          {trip ? (
            <>
              {trip.name} · {formatDateRange(trip.departureDate, trip.returnDate, locale)}
            </>
          ) : (
            "—"
          )}
        </dd>
        <dt className="text-muted-foreground">{t("steps.seat")}</dt>
        <dd>{seatNumber ? `#${seatNumber}` : "—"}</dd>
        <dt className="text-muted-foreground">{t("steps.hotel")}</dt>
        <dd>
          {hotel?.name ?? "—"}
          {roomType ? ` · ${tc(`room.${roomType}`)}` : ""}
        </dd>
        <dt className="text-muted-foreground">{t("pricing.total")}</dt>
        <dd className="font-semibold">
          {pricing ? formatCurrency(pricing.total, locale) : "—"}
        </dd>
      </dl>
    </div>
  )
}
