import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"

/**
 * Full-page loading state shown above the router during auth bootstrap.
 * Reused by <AuthGate>. No props — all state lives in the auth store.
 */
export function SplashScreen() {
  const { t } = useTranslation()
  return (
    <div
      role="status"
      className="flex min-h-screen items-center justify-center bg-background"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="text-2xl font-semibold tracking-tight">
          {t("app.name")}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          <span>{t("loading")}</span>
        </div>
      </div>
    </div>
  )
}
