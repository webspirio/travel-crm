import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"
import { de, uk } from "date-fns/locale"
import { ChevronLeft, ChevronRight, ArrowRight, ArrowLeft } from "lucide-react"

import { TripEvent } from "@/components/calendar/trip-event"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useManagers } from "@/hooks/queries/use-managers"
import { useTrips } from "@/hooks/queries/use-trips"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ALL_TRIP_STATUSES, tripStatusVariant } from "@/lib/trip-status"
import type { Locale, Trip } from "@/types"

function defaultMonthAnchor(ts: Trip[], today: Date): Date {
  const next = ts
    .filter((tr) => tr.departureDate >= today)
    .sort((a, b) => a.departureDate.getTime() - b.departureDate.getTime())[0]
  return startOfMonth(next?.departureDate ?? today)
}

export default function CalendarPage() {
  const { t, i18n } = useTranslation("calendar")
  const { t: tc } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale
  const dateFnsLocale = locale === "uk" ? uk : de

  const { data: trips = [] } = useTrips()
  const { data: managers = [] } = useManagers()

  // Stable identity across renders. Recomputed only on remount, so the
  // calendar's "today" reference doesn't drift across an active session.
  const today = useMemo(() => new Date(), [])

  const [anchor, setAnchor] = useState<Date>(() => startOfMonth(today))
  const [destination, setDestination] = useState<string>("all")
  const [status, setStatus] = useState<string>("all")
  const [managerId, setManagerId] = useState<string>("all")

  // Re-anchor once trips arrive so the calendar opens on the next
  // upcoming-trip's month rather than the current month. Only fires
  // once, on first arrival of trips data.
  const anchoredRef = useRef(false)
  useEffect(() => {
    if (!anchoredRef.current && trips.length > 0) {
      setAnchor(defaultMonthAnchor(trips, today))
      anchoredRef.current = true
    }
  }, [trips, today])

  const filtered = useMemo(
    () =>
      trips.filter(
        (tr) =>
          (destination === "all" || tr.destination === destination) &&
          (status === "all" || tr.status === status) &&
          (managerId === "all" || tr.managerId === managerId),
      ),
    [trips, destination, status, managerId],
  )

  const destinations = useMemo(
    () => [...new Set(trips.map((tr) => tr.destination))].sort(),
    [trips],
  )

  const nextDeparture = useMemo(
    () =>
      [...filtered]
        .filter((tr) => tr.departureDate >= today)
        .sort((a, b) => a.departureDate.getTime() - b.departureDate.getTime())[0],
    [filtered],
  )

  const anchorTime = anchor.getTime()
  const monthStart = useMemo(() => startOfMonth(new Date(anchorTime)), [anchorTime])
  const monthEnd = useMemo(() => endOfMonth(new Date(anchorTime)), [anchorTime])
  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(monthStart, { weekStartsOn: 1 }),
        end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
      }),
    [monthStart, monthEnd],
  )

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Array<{ trip: Trip; kind: "departure" | "return" }>>()
    const key = (d: Date) => format(d, "yyyy-MM-dd")
    for (const tr of filtered) {
      const dep = key(tr.departureDate)
      const ret = key(tr.returnDate)
      if (!map.has(dep)) map.set(dep, [])
      map.get(dep)!.push({ trip: tr, kind: "departure" })
      if (!map.has(ret)) map.set(ret, [])
      map.get(ret)!.push({ trip: tr, kind: "return" })
    }
    return map
  }, [filtered])

  const monthStartTime = monthStart.getTime()
  const monthEndTime = monthEnd.getTime()
  const agenda = useMemo(
    () =>
      filtered
        .filter((tr) => {
          const dep = tr.departureDate.getTime()
          const ret = tr.returnDate.getTime()
          return (
            (dep >= monthStartTime && dep <= monthEndTime) ||
            (ret >= monthStartTime && ret <= monthEndTime)
          )
        })
        .sort((a, b) => a.departureDate.getTime() - b.departureDate.getTime()),
    [filtered, monthStartTime, monthEndTime],
  )

  const weekdays = t("weekdays", { returnObjects: true }) as string[]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {nextDeparture && (
          <Card size="sm" className="min-w-[260px]">
            <CardHeader>
              <CardDescription>{t("nextDeparture")}</CardDescription>
              <CardTitle className="text-base">
                <Link
                  to={`/trips/${nextDeparture.id}`}
                  className="hover:underline"
                >
                  {nextDeparture.name}
                </Link>
              </CardTitle>
              <CardDescription>
                {formatDate(nextDeparture.departureDate, locale)} ·{" "}
                {t("nextDepartureIn", {
                  days: Math.max(0, differenceInCalendarDays(nextDeparture.departureDate, today)),
                })}
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setAnchor((a) => subMonths(a, 1))}
            aria-label={t("prev")}
          >
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(startOfMonth(today))}>
            {t("today")}
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setAnchor((a) => addMonths(a, 1))}
            aria-label={t("next")}
          >
            <ChevronRight />
          </Button>
          <div className="ml-2 min-w-[160px] text-lg font-semibold capitalize">
            {format(anchor, "LLLL yyyy", { locale: dateFnsLocale })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={destination} onValueChange={(v) => v && setDestination(v)}>
            <SelectTrigger size="sm" className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allDestinations")}</SelectItem>
              {destinations.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => v && setStatus(v)}>
            <SelectTrigger size="sm" className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allStatuses")}</SelectItem>
              {ALL_TRIP_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {tc(`status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={managerId} onValueChange={(v) => v && setManagerId(v)}>
            <SelectTrigger size="sm" className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allManagers")}</SelectItem>
              {managers.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
            {weekdays.map((w) => (
              <div key={w} className="px-2 py-2 text-center">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const inMonth = isSameMonth(day, anchor)
              const dayKey = format(day, "yyyy-MM-dd")
              const dayEvents = eventsByDate.get(dayKey) ?? []
              const isCurrentDay = isToday(day) || isSameDay(day, today)
              return (
                <div
                  key={dayKey}
                  className={cn(
                    "flex min-h-[110px] flex-col gap-1 border-r border-b p-1.5 last:border-r-0",
                    !inMonth && "bg-muted/20 text-muted-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-6 w-6 items-center justify-center self-start rounded-full text-xs tabular-nums",
                      isCurrentDay && "bg-primary text-primary-foreground font-semibold",
                    )}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {dayEvents.slice(0, 3).map(({ trip, kind }) => (
                      <TripEvent
                        key={`${trip.id}-${kind}`}
                        trip={trip}
                        kind={kind}
                        locale={locale}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="px-1 text-[10px] text-muted-foreground">
                        +{dayEvents.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("agenda.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {agenda.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("agenda.empty")}</p>
          ) : (
            <ul className="divide-y">
              {agenda.map((tr) => (
                <li key={tr.id} className="flex items-center gap-3 py-2.5">
                  <Badge variant={tripStatusVariant(tr.status)}>
                    {tc(`status.${tr.status}`)}
                  </Badge>
                  <Link
                    to={`/trips/${tr.id}`}
                    className="flex-1 truncate font-medium hover:underline"
                  >
                    {tr.name}
                  </Link>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowRight className="size-3" />
                    {formatDate(tr.departureDate, locale)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowLeft className="size-3" />
                    {formatDate(tr.returnDate, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
