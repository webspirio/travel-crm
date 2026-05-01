import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import { StepHotel } from "@/components/booking-form/step-hotel"
import { StepPricing } from "@/components/booking-form/step-pricing"
import { StepSeats } from "@/components/booking-form/step-seats"
import { StepSummary } from "@/components/booking-form/step-summary"
import { StepTravelers } from "@/components/booking-form/step-travelers"
import { StepTrip } from "@/components/booking-form/step-trip"
import { STEPS, Stepper } from "@/components/booking-form/stepper"
import { useTravelersCanContinue } from "@/hooks/use-travelers-can-continue"
import { useSeatsCanContinue } from "@/hooks/use-seats-can-continue"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCreateBooking } from "@/hooks/mutations/use-create-booking"
import { useBookingStore, useLegacyBookingDraft } from "@/stores/booking-store"

export default function NewBookingPage() {
  const { t } = useTranslation("booking")
  const { t: tc } = useTranslation()
  const navigate = useNavigate()
  // Legacy selector drives all UI state in this page until Tasks 6-9 rewrite
  // the step components. The mutation receives the NEW BookingDraft shape via
  // useBookingStore.getState() at submit time. TODO(Task 9): migrate fully.
  const state = useLegacyBookingDraft()
  const { step, setStep, reset } = state

  const createBooking = useCreateBooking()

  // Travelers step (index 0) gates via the new multi-passenger draft. The
  // hook subscribes to the new store + runs the duplicate-detection query
  // unconditionally, so we always get a fresh boolean even when the user is
  // on a later step. Other steps still read from the legacy compatibility
  // selector — Tasks 7-10 will migrate them.
  const travelersOk = useTravelersCanContinue()
  const seatsOk = useSeatsCanContinue()

  const canContinue = useMemo(() => {
    switch (step) {
      case 0:
        return travelersOk
      case 1:
        return Boolean(state.tripId)
      case 2:
        return seatsOk
      case 3:
        // Allow advance when a hotel+room is chosen OR operator explicitly skips hotel.
        return Boolean(state.hotelId && state.roomType) || state.noHotel
      case 4:
        return Boolean(state.pricing)
      default:
        return true
    }
  }, [step, state, travelersOk, seatsOk])

  const renderStep = () => {
    switch (step) {
      case 0:
        return <StepTravelers />
      case 1:
        return <StepTrip />
      case 2:
        return <StepSeats />
      case 3:
        return <StepHotel />
      case 4:
        return <StepPricing />
      case 5:
        return <StepSummary />
      default:
        return null
    }
  }

  const onNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1)
      return
    }

    // Last step — submit the booking using the new BookingDraft shape.
    createBooking.mutate(
      { draft: useBookingStore.getState() },
      {
        onSuccess: ({ bookingId, bookingNumber }) => {
          toast.success(t("summary.toast", { bookingNumber }))
          reset()
          void navigate(`/bookings/${bookingId}`)
        },
        onError: (err) => {
          toast.error(err.message)
        },
      },
    )
  }

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

      <Stepper current={step} />

      <Card>
        <CardHeader>
          <CardTitle>{t(`steps.${STEPS[step]}`)}</CardTitle>
        </CardHeader>
        <CardContent>{renderStep()}</CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          <ArrowLeft className="size-4" />
          {tc("actions.back")}
        </Button>
        <Button onClick={onNext} disabled={!canContinue || createBooking.isPending}>
          {step === STEPS.length - 1 ? (
            <>
              <Check className="size-4" />
              {t("summary.confirmCta")}
            </>
          ) : (
            <>
              {tc("actions.next")}
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
