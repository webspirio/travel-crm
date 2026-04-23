import { useTranslation } from "react-i18next"

export default function ClientsListPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("nav.clients")}</h1>
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        Clients list — Phase F
      </div>
    </div>
  )
}
