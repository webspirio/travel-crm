import type { TFunction } from "i18next"
import { Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DESTRUCTIVE_STATUSES } from "@/lib/booking-status"
import { formatCurrency, formatDate } from "@/lib/format"
import type { Booking, Hotel, Locale } from "@/types"

interface Props {
  booking: Booking
  hotels: Hotel[]
  t: TFunction<"booking">
  tc: TFunction
  locale: Locale
  /** When provided AND status is non-terminal, renders an Edit button. */
  onEdit?: () => void
}

/**
 * Passengers table — name, kind, birth date, seat#, hotel, room, price,
 * special notes. T10 attaches the sensitive-edit sheet via `onEdit`.
 * Edit is hidden on terminal statuses (cancelled / no_show).
 */
export function PassengersCard({ booking, hotels, t, tc, locale, onEdit }: Props) {
  const editable = onEdit && !DESTRUCTIVE_STATUSES.has(booking.status)
  const hotelById = new Map(hotels.map((h) => [h.id, h]))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("detail.sections.passengers")}</CardTitle>
        {editable && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" />
            {t("detail.edit.edit")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("detail.passengers.name")}</TableHead>
              <TableHead>{t("detail.passengers.kind")}</TableHead>
              <TableHead>{t("detail.passengers.birthDate")}</TableHead>
              <TableHead>{t("detail.passengers.seat")}</TableHead>
              <TableHead>{t("detail.passengers.hotel")}</TableHead>
              <TableHead>{t("detail.passengers.room")}</TableHead>
              <TableHead className="text-right">{t("detail.passengers.price")}</TableHead>
              <TableHead>{t("detail.passengers.specialNotes")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {booking.passengers.map((p) => {
              const hotel = p.hotelId ? hotelById.get(p.hotelId) : undefined
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.firstName} {p.lastName}
                  </TableCell>
                  <TableCell>{t(`detail.passengers.${p.kind}`)}</TableCell>
                  <TableCell className="tabular-nums">
                    {p.birthDate ? formatDate(p.birthDate, locale) : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {p.seatNumber ? `#${p.seatNumber}` : "—"}
                  </TableCell>
                  <TableCell>{hotel?.name ?? "—"}</TableCell>
                  <TableCell>{p.roomType ? tc(`room.${p.roomType}`) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(p.price, locale)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.specialNotes ?? "—"}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
