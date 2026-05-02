import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useUpdateBookingWithReason } from "@/hooks/mutations/use-update-booking-with-reason"
import { useUpdatePassengerWithReason } from "@/hooks/mutations/use-update-passenger-with-reason"
import { requiresReason } from "@/lib/booking-status"
import { formatCurrency } from "@/lib/format"
import type { Booking, Locale } from "@/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  booking: Booking
  locale: Locale
}

/**
 * Sensitive edit sheet for pricing. Renders a custom grid (not a wizard step):
 *  • One row per passenger: name (read-only) + price input.
 *  • Footer: subtotal of new prices + a separate `total_price_eur` override.
 *
 * Save logic emits one `update_passenger_with_reason` per changed price plus
 * (if the booking-level total changed) one `update_booking_with_reason`. The
 * same reason is reused across all calls.
 *
 * Does NOT use `BookingDraftProvider` — the data here is independent of the
 * wizard draft shape.
 */
export function PricingEditSheet({ open, onOpenChange, booking, locale }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
        <PricingEditForm
          key={`${booking.id}:${open ? "open" : "closed"}`}
          booking={booking}
          locale={locale}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  )
}

interface PassengerPriceRow {
  id: string
  name: string
  price: number
}

function PricingEditForm({
  booking,
  locale,
  onClose,
}: {
  booking: Booking
  locale: Locale
  onClose: () => void
}) {
  const { t } = useTranslation("booking")
  const updatePassenger = useUpdatePassengerWithReason()
  const updateBooking = useUpdateBookingWithReason()

  const initialRows = useMemo<PassengerPriceRow[]>(
    () =>
      booking.passengers.map((p) => ({
        id: p.id,
        name: `${p.firstName} ${p.lastName}`.trim() || "—",
        price: p.price,
      })),
    [booking.passengers],
  )
  const [rows, setRows] = useState<PassengerPriceRow[]>(initialRows)
  const [bookingTotal, setBookingTotal] = useState<number>(booking.totalPrice)

  const [reason, setReason] = useState("")
  const reasonRequired = requiresReason(booking.status, "pricing")

  const originalPriceById = useMemo(
    () => new Map(booking.passengers.map((p) => [p.id, p.price])),
    [booking.passengers],
  )

  const subtotal = rows.reduce((sum, r) => sum + (Number.isFinite(r.price) ? r.price : 0), 0)

  const changedPassengers = rows.filter((r) => {
    const orig = originalPriceById.get(r.id)
    return orig !== undefined && Number(r.price) !== Number(orig)
  })
  const totalChanged = Number(bookingTotal) !== Number(booking.totalPrice)
  const hasChanges = changedPassengers.length > 0 || totalChanged

  const isPending = updatePassenger.isPending || updateBooking.isPending

  function handlePriceChange(id: string, raw: string) {
    const parsed = raw === "" ? 0 : Number(raw)
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, price: Number.isFinite(parsed) ? parsed : r.price } : r,
      ),
    )
  }

  function handleSave() {
    if (!hasChanges) {
      onClose()
      return
    }
    const passengerCalls = changedPassengers.length
    const bookingCalls = totalChanged ? 1 : 0
    let remaining = passengerCalls + bookingCalls
    let firstError: Error | null = null

    const finish = () => {
      remaining -= 1
      if (remaining === 0) {
        if (firstError) {
          toast.error(firstError.message || t("detail.toast.updateFailed"))
        } else {
          toast.success(t("detail.toast.pricingUpdated"))
          onClose()
        }
      }
    }

    const reasonArg = reasonRequired ? reason.trim() : undefined

    for (const r of changedPassengers) {
      updatePassenger.mutate(
        {
          id: r.id,
          bookingId: booking.id,
          patch: { price_total_eur: r.price },
          reason: reasonArg,
        },
        {
          onSuccess: finish,
          onError: (err) => {
            if (!firstError) firstError = err
            finish()
          },
        },
      )
    }

    if (totalChanged) {
      updateBooking.mutate(
        {
          id: booking.id,
          patch: { total_price_eur: Number(bookingTotal) },
          reason: reasonArg,
        },
        {
          onSuccess: finish,
          onError: (err) => {
            if (!firstError) firstError = err
            finish()
          },
        },
      )
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{t("detail.edit.pricingTitle")}</SheetTitle>
        <SheetDescription>{t("detail.edit.pricingDescription")}</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-4 overflow-y-auto px-4">
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_8rem] gap-2 text-xs font-medium text-muted-foreground">
            <span>{t("detail.edit.pricingPassenger")}</span>
            <span className="text-right">{t("detail.edit.pricingPrice")}</span>
          </div>
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[1fr_8rem] items-center gap-2">
              <span className="text-sm">{r.name}</span>
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={Number.isFinite(r.price) ? r.price : 0}
                onChange={(e) => handlePriceChange(r.id, e.target.value)}
                disabled={isPending}
                className="text-right tabular-nums"
              />
            </div>
          ))}
        </div>

        <div className="space-y-2 rounded-md border p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {t("detail.edit.pricingSubtotal")}
            </span>
            <span className="tabular-nums font-medium">
              {formatCurrency(subtotal, locale)}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pricing-edit-total">{t("detail.edit.pricingTotal")}</Label>
          <Input
            id="pricing-edit-total"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={Number.isFinite(bookingTotal) ? bookingTotal : 0}
            onChange={(e) => {
              const v = e.target.value
              const parsed = v === "" ? 0 : Number(v)
              setBookingTotal(Number.isFinite(parsed) ? parsed : bookingTotal)
            }}
            disabled={isPending}
            className="text-right tabular-nums"
          />
        </div>

        {reasonRequired && (
          <div className="space-y-2">
            <Label htmlFor="pricing-edit-reason">{t("detail.edit.reason")}</Label>
            <Textarea
              id="pricing-edit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("detail.edit.reasonPlaceholder")}
              rows={2}
              disabled={isPending}
            />
          </div>
        )}
      </div>

      <SheetFooter className="flex flex-row justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          {t("detail.edit.cancel")}
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={
            isPending ||
            !hasChanges ||
            (reasonRequired && reason.trim() === "")
          }
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isPending ? t("detail.edit.saving") : t("detail.edit.save")}
        </Button>
      </SheetFooter>
    </>
  )
}
