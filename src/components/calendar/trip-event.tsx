import { useTranslation } from "react-i18next"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Link } from "react-router"

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Progress } from "@/components/ui/progress"
import { useManagers } from "@/hooks/queries/use-managers"
import { formatDateRange } from "@/lib/format"
import { cn } from "@/lib/utils"
import { TRIP_STATUS_CLASS } from "@/lib/trip-status"
import type { Locale, Trip } from "@/types"

interface TripEventProps {
  trip: Trip
  kind: "departure" | "return"
  locale: Locale
}

export function TripEvent({ trip, kind, locale }: TripEventProps) {
  const { t } = useTranslation("calendar")
  const { t: tc } = useTranslation()
  const { data: managers = [] } = useManagers()
  const manager = managers.find((m) => m.id === trip.managerId)
  const percent = Math.round((trip.bookedCount / trip.capacity) * 100)

  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <Link
            to={`/trips/${trip.id}`}
            className={cn(
              "flex w-full items-center gap-1 truncate rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-tight transition-all hover:brightness-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              TRIP_STATUS_CLASS[trip.status],
            )}
          />
        }
      >
        {kind === "departure" ? (
          <ArrowRight className="size-3 shrink-0" />
        ) : (
          <ArrowLeft className="size-3 shrink-0" />
        )}
        <span className="truncate">
          {kind === "departure" ? trip.name : `← ${trip.origin}`}
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-72">
        <div className="space-y-2">
          <div>
            <div className="font-medium">{trip.name}</div>
            <div className="text-xs text-muted-foreground">
              {formatDateRange(trip.departureDate, trip.returnDate, locale)}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">{t("popover.capacity")}</span>
            <Progress value={percent} className="flex-1" />
            <span className="tabular-nums text-muted-foreground">
              {trip.bookedCount}/{trip.capacity}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {t("popover.manager")}: {manager?.name ?? "—"}
            </span>
            <span className="font-medium">{tc(`status.${trip.status}`)}</span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
