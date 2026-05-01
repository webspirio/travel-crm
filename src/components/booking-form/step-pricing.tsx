import { useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useHotelById } from "@/hooks/queries/use-hotels"
import { useTripById } from "@/hooks/queries/use-trips"
import { formatCurrency } from "@/lib/format"
import { useBookingStore } from "@/stores/booking-store"
import type { Locale } from "@/types"

export function StepPricing() {
  const { t, i18n } = useTranslation("booking")
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale
  const { tripId, hotelId, roomType, noHotel, update } = useBookingStore()

  const { data: trip } = useTripById(tripId ?? undefined)
  const { data: hotel } = useHotelById(hotelId ?? undefined)

  const pricing = useMemo(() => {
    if (!trip) return null

    if (noHotel || (!hotelId && !roomType)) {
      // Bus-only booking: no hotel cost, total is just the base price.
      const total = trip.basePrice
      return {
        basePrice: trip.basePrice,
        hotelCost: 0,
        total,
        commission: Math.round(total * 0.1),
      }
    }

    if (!hotel || !roomType) return null

    const nights = Math.max(
      1,
      Math.round(
        (trip.returnDate.getTime() - trip.departureDate.getTime()) / (1000 * 60 * 60 * 24),
      ),
    )
    const hotelCost = hotel.rooms[roomType].pricePerNight * nights
    const total = trip.basePrice + hotelCost
    return {
      basePrice: trip.basePrice,
      hotelCost,
      total,
      commission: Math.round(total * 0.1),
    }
  }, [trip, hotel, roomType, hotelId, noHotel])

  useEffect(() => {
    update({ pricing })
  }, [pricing, update])

  if (!pricing) {
    return <p className="text-muted-foreground">Select trip, hotel, and room type first.</p>
  }

  return (
    <div className="mx-auto max-w-md space-y-2 rounded-md border p-4">
      <Row label={t("pricing.basePrice")} value={formatCurrency(pricing.basePrice, locale)} />
      {pricing.hotelCost > 0 && (
        <Row label={t("pricing.hotelCost")} value={formatCurrency(pricing.hotelCost, locale)} />
      )}
      <hr />
      <Row
        label={t("pricing.total")}
        value={formatCurrency(pricing.total, locale)}
        bold
      />
      <Row
        label={t("pricing.commission")}
        value={formatCurrency(pricing.commission, locale)}
        muted
      />
    </div>
  )
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string
  value: string
  bold?: boolean
  muted?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between ${
        bold ? "text-lg font-semibold" : "text-sm"
      } ${muted ? "text-muted-foreground" : ""}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
