import { useTranslation } from "react-i18next"

export default function NewBookingPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("nav.newBooking")}</h1>
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        Booking wizard — Phase F
      </div>
    </div>
  )
}
