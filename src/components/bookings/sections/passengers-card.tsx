import type { TFunction } from "i18next"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/format"
import type { Booking, Hotel, Locale } from "@/types"

interface Props {
  booking: Booking
  hotels: Hotel[]
  t: TFunction<"booking">
  tc: TFunction
  locale: Locale
}

/**
 * Passengers table — name, kind, birth date, seat#, hotel, room, price,
 * special notes. Read-only; T10 brings sensitive-edit affordances.
 */
export function PassengersCard({ booking, hotels, t, tc, locale }: Props) {
  const hotelById = new Map(hotels.map((h) => [h.id, h]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("detail.sections.passengers")}</CardTitle>
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
