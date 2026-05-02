import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useStore } from "zustand"
import { Loader2 } from "lucide-react"

import { StepSeats } from "@/components/booking-form/step-seats"
import { StepTravelers } from "@/components/booking-form/step-travelers"
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
import { useUpdatePassengerWithReason, type UpdatePassengerPatch } from "@/hooks/mutations/use-update-passenger-with-reason"
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
 * Sensitive edit sheet for passenger names, birth dates, seat numbers, and
 * special notes. Reuses `<StepTravelers editMode />` + `<StepSeats />` inside
 * an isolated `BookingDraftProvider`. Save diffs the draft against the saved
 * booking and emits one `update_passenger_with_reason` RPC per changed row.
 *
 * Out of scope for v1 (deferred):
 *  • Adding new passengers — needs an INSERT RPC not in T2.
 *  • Removing passengers — needs DELETE.
 * The Add/Remove buttons are hidden via the `editMode` prop on the steps.
 *
 * The form is keyed on `open + booking.id` so React unmounts/remounts it on
 * every re-open, re-seeding the isolated store from the latest server data.
 */
export function PassengersEditSheet({ open, onOpenChange, booking, hotels }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-3xl">
        <PassengersEditForm
          key={`${booking.id}:${open ? "open" : "closed"}`}
          booking={booking}
          hotels={hotels}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  )
}

function PassengersEditForm({
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

  // One isolated store per mount, seeded from the saved booking. Wrapped in
  // useState so the factory only runs once.
  const [draftStore] = useState(() =>
    createIsolatedBookingDraftStore(bookingToDraft(booking, hotels)),
  )

  const [reason, setReason] = useState("")
  const reasonRequired = requiresReason(booking.status, "passengers")

  // Cache the original passengers so the diff at save time has a stable
  // reference (booking.passengers is referentially stable per render anyway,
  // but Map lookups are clearer this way).
  const originalById = useMemo(
    () => new Map(booking.passengers.map((p) => [p.id, p])),
    [booking.passengers],
  )

  // Snapshot the draft's current state into a list of patches keyed by id.
  // Whitelisted fields only — hotel/room/price live in their own sheets to
  // avoid double-saves and ambiguous reasons.
  function buildPatches(): { id: string; patch: UpdatePassengerPatch }[] {
    const drafts = draftStore.getState().passengers
    const patches: { id: string; patch: UpdatePassengerPatch }[] = []
    for (const d of drafts) {
      const orig = originalById.get(d.localId)
      if (!orig) continue // new passengers (out of scope) — skip
      const patch: UpdatePassengerPatch = {}
      if (d.firstName !== orig.firstName) patch.first_name = d.firstName
      if (d.lastName !== orig.lastName) patch.last_name = d.lastName
      const origBirth = orig.birthDate ? toISODate(orig.birthDate) : null
      if ((d.birthDate ?? null) !== origBirth) patch.birth_date = d.birthDate
      if ((d.seatNumber ?? null) !== (orig.seatNumber ?? null)) {
        patch.seat_number = d.seatNumber
      }
      // special_notes is not in the PassengerDraft shape — the wizard's
      // step-travelers does not surface it. We skip it for v1; future work
      // can extend the draft + step-travelers to carry it.
      if (Object.keys(patch).length > 0) {
        patches.push({ id: orig.id, patch })
      }
    }
    return patches
  }

  const isPending = updatePassenger.isPending

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
                toast.success(t("detail.toast.passengersUpdated"))
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

  // Subscribe to the draft passengers so the Save button enable state stays
  // reactive as the user edits fields inside the embedded steps. We don't
  // need the value here — the subscription is purely to drive re-renders.
  useStore(draftStore, (s) => s.passengers)
  const hasChanges = buildPatches().length > 0

  return (
    <BookingDraftProvider store={draftStore}>
      <SheetHeader>
        <SheetTitle>{t("detail.edit.passengersTitle")}</SheetTitle>
        <SheetDescription>{t("detail.edit.passengersDescription")}</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-6 overflow-y-auto px-4">
        <StepTravelers editMode />
        <StepSeats />

        {reasonRequired && (
          <div className="space-y-2">
            <Label htmlFor="passengers-edit-reason">{t("detail.edit.reason")}</Label>
            <Textarea
              id="passengers-edit-reason"
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

/** Local YYYY-MM-DD; mirrors `bookingToDraft.toISODate` for diff parity. */
function toISODate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}
