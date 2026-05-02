import { useEffect, useMemo, useRef } from "react"
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { StepReview } from "@/components/booking-form/step-review"
import { StepRooms } from "@/components/booking-form/step-rooms"
import { StepSeats } from "@/components/booking-form/step-seats"
import { StepTravelers } from "@/components/booking-form/step-travelers"
import { StepTrip } from "@/components/booking-form/step-trip"
import { STEPS, Stepper } from "@/components/booking-form/stepper"
import { useTravelersCanContinue } from "@/hooks/use-travelers-can-continue"
import { useSeatsCanContinue } from "@/hooks/use-seats-can-continue"
import { useRoomsCanContinue } from "@/hooks/use-rooms-can-continue"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useBookingStore } from "@/stores/booking-store"

// Step indices for the 5-step wizard:
//   0 = Trip
//   1 = Travelers
//   2 = Seats
//   3 = Rooms
//   4 = Review  (Confirm button lives inside the step; outer Next is hidden)
const LAST_STEP = STEPS.length - 1

/** Returns true when the event target is an editable element (input/textarea/ce). */
function isEditable(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  )
}

export default function NewBookingPage() {
  const { t } = useTranslation("booking")
  const { t: tc } = useTranslation()

  const step = useBookingStore((s) => s.step)
  const setStep = useBookingStore((s) => s.setStep)
  const reset = useBookingStore((s) => s.reset)

  // ── Per-step canContinue gates ─────────────────────────────────────
  const tripId = useBookingStore((s) => s.tripId)
  const travelersOk = useTravelersCanContinue()
  const seatsOk = useSeatsCanContinue()
  const roomsOk = useRoomsCanContinue()

  const canContinue = useMemo((): boolean => {
    switch (step) {
      case 0: return Boolean(tripId)
      case 1: return travelersOk
      case 2: return seatsOk
      case 3: return roomsOk
      case 4: return true   // Review: Confirm button inside the step gates submission
      default: return true
    }
  }, [step, tripId, travelersOk, seatsOk, roomsOk])

  // ── Hydration reset-toast ──────────────────────────────────────────
  // The persist migrate (Task 4) sets this flag when it cannot migrate
  // a corrupted v1 draft. Show once and clear.
  useEffect(() => {
    if (localStorage.getItem("anytour-booking-draft-reset-toast") === "1") {
      localStorage.removeItem("anytour-booking-draft-reset-toast")
      toast.info(t("travelers.draftReset"))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Stepper ref (Esc focuses it) ───────────────────────────────────
  const stepperRef = useRef<HTMLOListElement>(null)

  // ── Global hotkeys ─────────────────────────────────────────────────
  // - Cmd/Ctrl+Enter  → advance step when canContinue (noop on review step)
  // - Esc             → focus stepper
  // - Alt+N           → add adult traveler (only on Travelers step)
  // - Alt+F           → family-of-4 sequence (only on Travelers step)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't steal keys from inputs/textareas.
      if (isEditable(e.target)) return

      // Cmd/Ctrl+Enter → advance
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        if (step < LAST_STEP && canContinue) {
          setStep(step + 1)
        }
        // On the review step the Confirm button inside StepReview handles submission.
        return
      }

      // Esc → focus stepper (allow back-nav by Tab/click)
      if (e.key === "Escape") {
        e.preventDefault()
        stepperRef.current?.focus()
        return
      }

      if (!e.altKey) return

      // Alt+N → add adult traveler
      if ((e.key === "n" || e.key === "N") && step === 1) {
        e.preventDefault()
        useBookingStore.getState().addPassenger("adult")
        return
      }

      // Alt+F → family-of-4 (1 adult + 2 children, share primary lastName)
      if ((e.key === "f" || e.key === "F") && step === 1) {
        e.preventDefault()
        const state = useBookingStore.getState()
        const primary = state.passengers[0]
        if (!primary) return
        const ln = primary.lastName
        state.addPassenger("adult")
        state.addPassenger("child")
        state.addPassenger("child")
        // Copy lastName to the 3 new passengers on the next tick (store async).
        requestAnimationFrame(() => {
          const fresh = useBookingStore.getState()
          const added = fresh.passengers.slice(-3)
          added.forEach((p) => {
            if (ln) fresh.updatePassenger(p.localId, { lastName: ln })
          })
        })
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [step, canContinue, setStep])

  // ── Step render ────────────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 0: return <StepTrip />
      case 1: return <StepTravelers />
      case 2: return <StepSeats />
      case 3: return <StepRooms />
      case 4: return <StepReview />
      default: return null
    }
  }

  const isReviewStep = step === LAST_STEP

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw className="size-4" />
          {tc("actions.reset")}
        </Button>
      </div>

      {/* The `ref` needs to land on the <ol> rendered by Stepper. We pass it via a
          wrapper div since Stepper doesn't forward refs yet. */}
      <div ref={(el) => { stepperRef.current = el?.querySelector("ol") ?? null }}>
        <Stepper current={step} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t(`steps.${STEPS[step]}`)}</CardTitle>
        </CardHeader>
        <CardContent>{renderStep()}</CardContent>
      </Card>

      {/* Bottom nav: hide Next on review step (Confirm lives inside StepReview) */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          <ArrowLeft className="size-4" />
          {tc("actions.back")}
        </Button>

        {!isReviewStep && (
          <Button onClick={() => setStep(step + 1)} disabled={!canContinue}>
            {tc("actions.next")}
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
