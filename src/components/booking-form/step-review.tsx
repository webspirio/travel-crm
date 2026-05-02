import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTrips } from "@/hooks/queries/use-trips"
import { useHotels } from "@/hooks/queries/use-hotels"
import { useCreateBooking } from "@/hooks/mutations/use-create-booking"
import { formatCurrency, formatDateRange } from "@/lib/format"
import { translatePgError } from "@/lib/translate-pg-error"
import { useBookingStore } from "@/stores/booking-store"
import type { Locale } from "@/types"

/**
 * Read-only summary of the entire booking. The "Confirm booking" button
 * in this step drives submission — the outer wizard's Next button is
 * hidden when step === 4.
 */
export function StepReview() {
  const { t, i18n } = useTranslation("booking")
  const { t: tc } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale
  const navigate = useNavigate()

  const tripId = useBookingStore((s) => s.tripId)
  const passengers = useBookingStore((s) => s.passengers)
  const rooms = useBookingStore((s) => s.rooms)
  const noHotel = useBookingStore((s) => s.noHotel)
  const notes = useBookingStore((s) => s.notes)
  const update = useBookingStore((s) => s.update)
  const reset = useBookingStore((s) => s.reset)

  const { data: trips = [] } = useTrips()
  const { data: hotels = [] } = useHotels()
  const trip = trips.find((tr) => tr.id === tripId) ?? null

  const createBooking = useCreateBooking()

  // ── Totals ──────────────────────────────────────────────────────────
  const subtotal = passengers.reduce((sum, p) => sum + p.priceEur, 0)
  const commission = Math.round(subtotal * 0.1)

  // ── Room label helper ────────────────────────────────────────────────
  const roomLabelFor = (roomGroupId: string | null, n: number): string => {
    if (!roomGroupId) return t("review.noHotel")
    const room = rooms.find((r) => r.localId === roomGroupId)
    if (!room) return t("review.noHotel")
    const hotel = hotels.find((h) => h.id === room.hotelId)
    const hotelName = hotel?.name ?? "—"
    const roomTypeLabelKey = `rooms.roomType.${room.roomType}` as const
    const roomTypeLabel = t(roomTypeLabelKey as Parameters<typeof t>[0])
    return t("review.roomLabel", { n, type: roomTypeLabel, hotel: hotelName })
  }

  // Build a map of roomGroupId → room index (1-based)
  const roomIndexMap = new Map<string, number>()
  rooms.forEach((r, i) => roomIndexMap.set(r.localId, i + 1))

  // ── Submit ───────────────────────────────────────────────────────────
  const handleConfirm = () => {
    createBooking.mutate(
      { draft: useBookingStore.getState() },
      {
        onSuccess: ({ bookingId, bookingNumber }) => {
          toast.success(t("review.success", { number: bookingNumber }))
          reset()
          void navigate(`/bookings/${bookingId}`)
        },
        onError: (err) => {
          toast.error(translatePgError(err, tc))
        },
      },
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Trip details ──────────────────────────────────────────── */}
      {trip && (
        <section className="rounded-md border p-4 text-sm">
          <h3 className="mb-2 font-medium">{trip.name}</h3>
          <p className="text-muted-foreground">
            {formatDateRange(trip.departureDate, trip.returnDate, locale)}
          </p>
        </section>
      )}

      {/* ── Passenger table ───────────────────────────────────────── */}
      <section>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("review.passengerTable.name")}</TableHead>
              <TableHead>{t("review.passengerTable.kind")}</TableHead>
              <TableHead>{t("review.passengerTable.seat")}</TableHead>
              <TableHead>{t("review.passengerTable.room")}</TableHead>
              <TableHead className="text-right">{t("review.passengerTable.price")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {passengers.map((p) => {
              const isLapInfant = p.kind === "infant" && p.seatNumber === null
              const kindLabel =
                p.kind === "adult"
                  ? t("review.kindAdult")
                  : p.kind === "child"
                    ? t("review.kindChild")
                    : t("review.kindInfant")
              const seatLabel = isLapInfant
                ? t("review.lapInfant")
                : p.seatNumber !== null
                  ? `#${p.seatNumber}`
                  : "—"

              const roomIdx = p.roomGroupId ? (roomIndexMap.get(p.roomGroupId) ?? null) : null
              const roomLabel = noHotel
                ? t("review.noHotel")
                : roomLabelFor(p.roomGroupId, roomIdx ?? 0)

              return (
                <TableRow key={p.localId}>
                  <TableCell>
                    {p.firstName || p.lastName
                      ? `${p.firstName} ${p.lastName}`.trim()
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>{kindLabel}</TableCell>
                  <TableCell>{seatLabel}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{roomLabel}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(p.priceEur, locale)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </section>

      {/* ── Totals ────────────────────────────────────────────────── */}
      <section className="space-y-1 rounded-md border p-4 text-sm">
        <div className="flex justify-between">
          <span>{t("review.subtotal")}</span>
          <span className="tabular-nums">{formatCurrency(subtotal, locale)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>{t("review.commission")}</span>
          <span className="tabular-nums">{formatCurrency(commission, locale)}</span>
        </div>
        <hr className="my-1" />
        <div className="flex justify-between font-semibold">
          <span>{t("review.total")}</span>
          <span className="tabular-nums">{formatCurrency(subtotal, locale)}</span>
        </div>
      </section>

      {/* ── Notes ─────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <label className="text-sm font-medium" htmlFor="review-notes">
          {t("review.notes")}
        </label>
        <Textarea
          id="review-notes"
          value={notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder={t("review.notesPlaceholder")}
          rows={3}
        />
      </section>

      {/* ── Confirm button ────────────────────────────────────────── */}
      <div className="flex justify-end">
        <Button
          onClick={handleConfirm}
          disabled={createBooking.isPending}
          size="lg"
        >
          <Check className="size-4" />
          {t("review.confirm")}
        </Button>
      </div>
    </div>
  )
}
