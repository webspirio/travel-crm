import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import type { Booking } from "@/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  booking: Booking
}

/**
 * Frictionless edit surface for `bookings.notes`. No reason field — internal
 * notes are non-sensitive, the DB trigger does not require justification for
 * `notes`-only edits.
 *
 * The inner form is keyed on `open + booking.id` so React unmounts/remounts it
 * each time the sheet re-opens — that lets `useState(initial)` re-seed from
 * props without a setState-in-effect (which the React compiler ESLint rule
 * flags as a cascading-render risk).
 */
export function NotesEditSheet({ open, onOpenChange, booking }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
        <NotesEditForm
          // Force remount every time the sheet re-opens or the row changes
          // — re-seeds local state from `booking.notes` at mount-time.
          key={`${booking.id}:${open ? "open" : "closed"}`}
          booking={booking}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  )
}

function NotesEditForm({
  booking,
  onClose,
}: {
  booking: Booking
  onClose: () => void
}) {
  const { t } = useTranslation("booking")
  const updateBooking = useUpdateBookingWithReason()
  const [value, setValue] = useState<string>(booking.notes ?? "")

  function handleSave() {
    const trimmed = value.trim()
    updateBooking.mutate(
      {
        id: booking.id,
        patch: { notes: trimmed === "" ? null : value },
      },
      {
        onSuccess: () => {
          toast.success(t("detail.toast.notesUpdated"))
          onClose()
        },
        onError: (err) => {
          toast.error(err.message || t("detail.toast.updateFailed"))
        },
      },
    )
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{t("detail.edit.notesTitle")}</SheetTitle>
        <SheetDescription>{t("detail.edit.notesDescription")}</SheetDescription>
      </SheetHeader>

      <div className="flex-1 px-4">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("detail.edit.notesPlaceholder")}
          rows={10}
          disabled={updateBooking.isPending}
        />
      </div>

      <SheetFooter className="flex flex-row justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={updateBooking.isPending}
        >
          {t("detail.edit.cancel")}
        </Button>
        <Button type="button" onClick={handleSave} disabled={updateBooking.isPending}>
          {updateBooking.isPending && <Loader2 className="size-4 animate-spin" />}
          {updateBooking.isPending ? t("detail.edit.saving") : t("detail.edit.save")}
        </Button>
      </SheetFooter>
    </>
  )
}
