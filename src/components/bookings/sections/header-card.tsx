import type { TFunction } from "i18next"
import { Mail, Phone } from "lucide-react"
import { Link } from "react-router"

import { Badge } from "@/components/ui/badge"
import { bookingStatusVariant } from "@/lib/booking-status"
import { formatCurrency, formatDateRange } from "@/lib/format"
import type { Booking, Client, Locale, Trip } from "@/types"

interface Props {
  booking: Booking
  client: Client | null | undefined
  trip: Trip | null | undefined
  t: TFunction<"booking">
  tc: TFunction
  locale: Locale
}

/**
 * Booking-detail header — booking#/contract#, status badge, totals, trip
 * one-liner, client one-liner. Pure display; relocated from `detail.tsx`
 * without redesign so the existing visual stays intact.
 */
export function HeaderCard({ booking, client, trip, t, tc, locale }: Props) {
  const outstanding = Math.max(0, booking.totalPrice - booking.paidAmount)

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tabular-nums">
            {t("detail.fields.booking")} #{booking.bookingNumber}
            {booking.contractNumber !== null && (
              <span className="ml-2 text-lg font-normal text-muted-foreground">
                · {t("detail.fields.contract")}: #{booking.contractNumber}
              </span>
            )}
          </h1>
          <Badge variant={bookingStatusVariant(booking.status)}>
            {tc(`bookingStatus.${booking.status}`)}
          </Badge>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
          <div>
            <span className="text-muted-foreground">{t("detail.fields.total")}: </span>
            <span className="tabular-nums font-medium">
              {formatCurrency(booking.totalPrice, locale)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">{t("detail.fields.paid")}: </span>
            <span className="tabular-nums font-medium">
              {formatCurrency(booking.paidAmount, locale)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">{t("detail.fields.outstanding")}: </span>
            <span className="tabular-nums font-medium">
              {formatCurrency(outstanding, locale)}
            </span>
          </div>
        </div>

        {trip && (
          <p className="mt-1 text-sm text-muted-foreground">
            {trip.name}
            {" · "}
            {formatDateRange(trip.departureDate, trip.returnDate, locale)}
          </p>
        )}

        {client && (
          <p className="mt-1 text-sm text-muted-foreground">
            <Link to={`/clients/${client.id}`} className="font-medium hover:underline">
              {client.firstName} {client.lastName}
            </Link>
            {client.email && (
              <a
                href={`mailto:${client.email}`}
                className="ml-3 inline-flex items-center gap-1 hover:underline"
              >
                <Mail className="size-3" />
                {client.email}
              </a>
            )}
            {client.phone && (
              <a
                href={`tel:${client.phone}`}
                className="ml-3 inline-flex items-center gap-1 hover:underline"
              >
                <Phone className="size-3" />
                {client.phone}
              </a>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
