import { Bus, Euro, Users, TrendingUp, CalendarDays } from "lucide-react"
import CountUpImport from "react-countup"
import { useTranslation } from "react-i18next"
import type { LucideIcon } from "lucide-react"

// Vite/Rolldown CJS interop: react-countup's default export is wrapped in
// a module object — unwrap the inner .default when present.
const CountUp =
  (CountUpImport as unknown as { default?: typeof CountUpImport }).default ??
  CountUpImport

import { RevenueChart } from "@/components/charts/revenue-chart"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { clients, stats, trips } from "@/data"
import { formatCurrency, formatDate } from "@/lib/format"
import type { Locale } from "@/types"

interface KpiCardProps {
  titleKey: string
  value: number
  icon: LucideIcon
  suffix?: string
  prefix?: string
  formatter?: (value: number) => string
}

function KpiCard({ titleKey, value, icon: Icon, suffix, prefix, formatter }: KpiCardProps) {
  const { t } = useTranslation("dashboard")
  return (
    <Card>
      <CardHeader>
        <CardDescription>{t(titleKey)}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">
          <CountUp
            end={value}
            duration={1.2}
            separator=" "
            prefix={prefix}
            suffix={suffix}
            formattingFn={formatter}
          />
        </CardTitle>
        <CardAction>
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
        </CardAction>
      </CardHeader>
    </Card>
  )
}

export default function DashboardPage() {
  const { t, i18n } = useTranslation("dashboard")
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale

  const clientById = new Map(clients.map((c) => [c.id, c]))
  const tripById = new Map(trips.map((t) => [t.id, t]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          titleKey="kpi.totalRevenue"
          value={stats.totalRevenue}
          icon={Euro}
          formatter={(v) => formatCurrency(v, locale)}
        />
        <KpiCard titleKey="kpi.activeTrips" value={stats.activeTripsCount} icon={Bus} />
        <KpiCard titleKey="kpi.totalClients" value={stats.totalClients} icon={Users} />
        <KpiCard
          titleKey="kpi.avgOccupancy"
          value={stats.avgOccupancy}
          icon={TrendingUp}
          suffix="%"
        />
        <KpiCard
          titleKey="kpi.upcomingDepartures"
          value={stats.upcomingDepartures}
          icon={CalendarDays}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>{t("charts.revenueTitle")}</CardTitle>
            <CardDescription>{t("charts.revenueSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{t("charts.topHotelsTitle")}</CardTitle>
            <CardDescription>{t("charts.topHotelsSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.topHotels.map((h) => (
              <div key={h.hotelId} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{h.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {h.bookingsCount}
                  </span>
                </div>
                <Progress value={h.percent} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("recent.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("recent.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("recent.client")}</TableHead>
                  <TableHead>{t("recent.trip")}</TableHead>
                  <TableHead className="text-right">{t("recent.price")}</TableHead>
                  <TableHead className="text-right">{t("recent.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentBookings.map((b) => {
                  const client = clientById.get(b.clientId)
                  const trip = tripById.get(b.tripId)
                  return (
                    <TableRow key={b.id}>
                      <TableCell>
                        {client ? `${client.firstName} ${client.lastName}` : b.clientId}
                      </TableCell>
                      <TableCell>{trip?.name ?? b.tripId}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(b.totalPrice, locale)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDate(b.createdAt, locale)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
