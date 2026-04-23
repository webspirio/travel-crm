import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import type { SeatStatus } from "@/types"

const STATUSES: SeatStatus[] = ["free", "selected", "reserved", "sold", "blocked"]

const STATUS_STYLES: Record<SeatStatus, string> = {
  free: "border-border bg-background",
  selected: "border-primary bg-primary text-primary-foreground",
  reserved: "border-amber-500 bg-amber-500/20 text-amber-900 dark:text-amber-200",
  sold: "border-muted bg-muted text-muted-foreground",
  blocked: "border-destructive bg-destructive/10 text-destructive line-through",
}

export function SeatLegend() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      {STATUSES.map((s) => (
        <div key={s} className="flex items-center gap-1.5">
          <span
            className={cn("inline-block size-4 rounded border", STATUS_STYLES[s])}
            aria-hidden
          />
          <span>{t(`seat.${s}`)}</span>
        </div>
      ))}
    </div>
  )
}

export { STATUS_STYLES }
