import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useStore } from "zustand"
import { Loader2 } from "lucide-react"

import { StepRooms } from "@/components/booking-form/step-rooms"
import { Button } from "@/components/ui/button"
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
import {
  useUpdatePassengerWithReason,
  type UpdatePassengerPatch,
} from "@/hooks/mutations/use-update-passenger-with-reason"
import { BookingDraftProvider } from "@/lib/booking-draft-context"
import { bookingToDraft } from "@/lib/booking-draft-from-booking"
import { requiresReason } from "@/lib/booking-status"
import { createIsolatedBookingDraftStore } from "@/stores/booking-store"
import type { Booking, Hotel } from "@/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  booking: Booking
  hotels: Hotel[]
}

/**
 * Sensitive edit sheet for hotel + room assignments. Reuses
 * `<StepRooms editMode />` inside an isolated `BookingDraftProvider`.
 *
 * Save diffs each passenger's `(hotelId, roomType)` against the original and
 * emits one `update_passenger_with_reason` per changed row.
 *
 * Out of scope for v1 (deferred):
 *  • Adding new rooms — needs a room INSERT path in the schema.
 *  • Removing rooms — needs DELETE.
 * The Add/Remove room buttons are hidden via `editMode` on `<StepRooms />`.
 */
export function HotelsRoomsEditSheet({ open, onOpenChange, booking, hotels }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-3xl">
        <HotelsRoomsEditForm
          key={`${booking.id}:${open ? "open" : "closed"}`}
          booking={booking}
          hotels={hotels}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  )
}

function HotelsRoomsEditForm({
  booking,
  hotels,
  onClose,
}: {
  booking: Booking
  hotels: Hotel[]
  onClose: () => void
}) {
  const { t } = useTranslation("booking")
  const updatePassenger = useUpdatePassengerWithReason()

  const [draftStore] = useState(() =>
    createIsolatedBookingDraftStore(bookingToDraft(booking, hotels)),
  )

  const [reason, setReason] = useState("")
  const reasonRequired = requiresReason(booking.status, "hotelsRooms")

  const originalById = useMemo(
    () => new Map(booking.passengers.map((p) => [p.id, p])),
    [booking.passengers],
  )

  // Subscribe so Save button reflects edits.
  useStore(draftStore, (s) => s.passengers)

  function buildPatches(): { id: string; patch: UpdatePassengerPatch }[] {
    const drafts = draftStore.getState().passengers
    const patches: { id: string; patch: UpdatePassengerPatch }[] = []
    for (const d of drafts) {
      const orig = originalById.get(d.localId)
      if (!orig) continue
      const patch: UpdatePassengerPatch = {}
      const origHotelId = orig.hotelId || null
      const origRoomType = orig.roomType || null
      const draftHotelId = d.hotelId ?? null
      const draftRoomType = d.roomType ?? null
      if (draftHotelId !== origHotelId) patch.hotel_id = draftHotelId
      if (draftRoomType !== origRoomType) patch.room_type = draftRoomType
      if (Object.keys(patch).length > 0) {
        patches.push({ id: orig.id, patch })
      }
    }
    return patches
  }

  const isPending = updatePassenger.isPending
  const hasChanges = buildPatches().length > 0

  function handleSave() {
    const patches = buildPatches()
    if (patches.length === 0) {
      onClose()
      return
    }
    let remaining = patches.length
    let firstError: Error | null = null
    for (const { id, patch } of patches) {
      updatePassenger.mutate(
        { id, bookingId: booking.id, patch, reason: reasonRequired ? reason.trim() : undefined },
        {
          onSuccess: () => {
            remaining -= 1
            if (remaining === 0) {
              if (firstError) {
                toast.error(firstError.message || t("detail.toast.updateFailed"))
              } else {
                toast.success(t("detail.toast.hotelsRoomsUpdated"))
                onClose()
              }
            }
          },
          onError: (err) => {
            remaining -= 1
            if (!firstError) firstError = err
            if (remaining === 0) {
              toast.error(firstError?.message || t("detail.toast.updateFailed"))
            }
          },
        },
      )
    }
  }

  return (
    <BookingDraftProvider store={draftStore}>
      <SheetHeader>
        <SheetTitle>{t("detail.edit.hotelsRoomsTitle")}</SheetTitle>
        <SheetDescription>{t("detail.edit.hotelsRoomsDescription")}</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto px-4">
        <StepRooms editMode />

        {reasonRequired && (
          <div className="space-y-2">
            <Label htmlFor="hotels-rooms-edit-reason">{t("detail.edit.reason")}</Label>
            <Textarea
              id="hotels-rooms-edit-reason"
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
    </BookingDraftProvider>
  )
}
