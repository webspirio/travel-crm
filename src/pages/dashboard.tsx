import { useTranslation } from "react-i18next"

export default function DashboardPage() {
  const { t } = useTranslation("dashboard")
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        Dashboard content — Phase D
      </div>
    </div>
  )
}
