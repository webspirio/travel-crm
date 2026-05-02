import type { TFunction } from "i18next"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Booking } from "@/types"

interface Props {
  booking: Booking
  t: TFunction<"booking">
}

/**
 * Internal notes — read-only display of `booking.notes`. Renders an empty-
 * state placeholder when the field is null/empty. T9 swaps this for an
 * inline-editable surface.
 */
export function NotesCard({ booking, t }: Props) {
  const value = booking.notes?.trim()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("detail.sections.notes")}</CardTitle>
      </CardHeader>
      <CardContent>
        {!value ? (
          <p className="text-sm text-muted-foreground">{t("detail.notes.empty")}</p>
        ) : (
          <p className="whitespace-pre-wrap text-sm">{value}</p>
        )}
      </CardContent>
    </Card>
  )
}
