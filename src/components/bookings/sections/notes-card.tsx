import type { TFunction } from "i18next"
import { Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Booking } from "@/types"

interface Props {
  booking: Booking
  t: TFunction<"booking">
  /** When provided, renders an Edit button in the header. */
  onEdit?: () => void
}

/**
 * Internal notes — display of `booking.notes`. Renders an empty-state
 * placeholder when the field is null/empty. T9 attaches the inline-edit
 * affordance via the optional `onEdit` callback.
 */
export function NotesCard({ booking, t, onEdit }: Props) {
  const value = booking.notes?.trim()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("detail.sections.notes")}</CardTitle>
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" />
            {t("detail.edit.edit")}
          </Button>
        )}
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
