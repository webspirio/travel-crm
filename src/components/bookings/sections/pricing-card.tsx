import type { TFunction } from "i18next"
import { Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DESTRUCTIVE_STATUSES } from "@/lib/booking-status"
import { formatCurrency } from "@/lib/format"
import type { Booking, Locale } from "@/types"

interface Props {
  booking: Booking
  t: TFunction<"booking">
  locale: Locale
  /** When provided AND status is non-terminal, renders an Edit button. */
  onEdit?: () => void
}

/**
 * Pricing — one row per passenger (name + price), then footer with
 * subtotal / paid / balance derived from booking totals. T10 attaches the
 * sensitive-edit sheet via `onEdit`. Edit is hidden on terminal statuses.
 */
export function PricingCard({ booking, t, locale, onEdit }: Props) {
  const editable = onEdit && !DESTRUCTIVE_STATUSES.has(booking.status)
  const subtotal = booking.passengers.reduce((sum, p) => sum + p.price, 0)
  const balance = Math.max(0, booking.totalPrice - booking.paidAmount)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("detail.sections.pricing")}</CardTitle>
        {editable && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" />
            {t("detail.edit.edit")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-1 text-sm">
          {booking.passengers.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between border-b border-dashed py-1 last:border-b-0"
            >
              <span>
                {p.firstName} {p.lastName}
              </span>
              <span className="tabular-nums">{formatCurrency(p.price, locale)}</span>
            </div>
          ))}

          <div className="mt-3 space-y-1 border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("detail.pricing.subtotal")}</span>
              <span className="tabular-nums font-medium">
                {formatCurrency(subtotal, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("detail.pricing.paid")}</span>
              <span className="tabular-nums font-medium">
                {formatCurrency(booking.paidAmount, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("detail.pricing.balance")}</span>
              <span className="tabular-nums font-medium">
                {formatCurrency(balance, locale)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
