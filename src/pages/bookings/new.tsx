import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { StepClient } from "@/components/booking-form/step-client"
import { StepHotel } from "@/components/booking-form/step-hotel"
import { StepPricing } from "@/components/booking-form/step-pricing"
import { StepSeat } from "@/components/booking-form/step-seat"
import { StepSummary } from "@/components/booking-form/step-summary"
import { StepTrip } from "@/components/booking-form/step-trip"
import { STEPS, Stepper } from "@/components/booking-form/stepper"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useBookingStore } from "@/stores/booking-store"

export default function NewBookingPage() {
  const { t } = useTranslation("booking")
  const { t: tc } = useTranslation()
  const state = useBookingStore()
  const { step, setStep, reset } = state

  const canContinue = useMemo(() => {
    switch (step) {
      case 0:
        return Boolean(state.clientId) || Boolean(state.newClient?.firstName && state.newClient?.lastName && state.newClient?.email)
      case 1:
        return Boolean(state.tripId)
      case 2:
        return Boolean(state.seatNumber)
      case 3:
        return Boolean(state.hotelId && state.roomType)
      case 4:
        return Boolean(state.pricing)
      default:
        return true
    }
  }, [step, state])

  const renderStep = () => {
    switch (step) {
      case 0:
        return <StepClient />
      case 1:
        return <StepTrip />
      case 2:
        return <StepSeat />
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
    } else {
      toast.success(t("summary.toast"))
      reset()
    }
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
          Reset
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
        <Button onClick={onNext} disabled={!canContinue}>
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
