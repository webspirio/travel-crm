import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { Wallet, Clock, CheckCircle2, Percent } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { RevenueChart } from "@/components/charts/revenue-chart"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useBookings } from "@/hooks/queries/use-bookings"
import { useClients } from "@/hooks/queries/use-clients"
import { useManagers } from "@/hooks/queries/use-managers"
import { useTrips } from "@/hooks/queries/use-trips"
import { formatCurrency, formatDate } from "@/lib/format"
import { getManagerStats } from "@/lib/stats"
import type { Locale } from "@/types"

const TODAY = new Date("2026-04-23")
const IN_30_DAYS = new Date(TODAY.getTime() + 30 * 24 * 60 * 60 * 1000)

export default function FinancePage() {
  const { t, i18n } = useTranslation("finance")
  const { t: tc } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale

  const { data: trips = [] } = useTrips()
  const { data: clients = [] } = useClients()
  const { data: managers = [] } = useManagers()
  const { data: bookings = [] } = useBookings()

  const tripById = useMemo(() => new Map(trips.map((tr) => [tr.id, tr])), [trips])
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])

  const totals = useMemo(() => {
    let revenue = 0
    let outstanding = 0
    let commission = 0
    let paidThisMonth = 0
    const thisMonth = TODAY.toISOString().slice(0, 7)
    for (const b of bookings) {
      revenue += b.totalPrice
      outstanding += Math.max(0, b.totalPrice - b.paidAmount)
      commission += b.commission
      const trip = tripById.get(b.tripId)
      if (trip && trip.departureDate.toISOString().slice(0, 7) === thisMonth) {
        paidThisMonth += b.paidAmount
      }
    }
    return { revenue, outstanding, commission, paidThisMonth }
  }, [bookings, tripById])

  const paidVsOutstanding = useMemo(() => {
    const map = new Map<string, { paid: number; outstanding: number }>()
    for (const b of bookings) {
      const trip = tripById.get(b.tripId)
      if (!trip) continue
      const key = trip.departureDate.toISOString().slice(0, 7)
      const cur = map.get(key) ?? { paid: 0, outstanding: 0 }
      cur.paid += b.paidAmount
      cur.outstanding += Math.max(0, b.totalPrice - b.paidAmount)
      map.set(key, cur)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short" }),
        paid: v.paid,
        outstanding: v.outstanding,
      }))
  }, [bookings, tripById])

  const leaderboard = useMemo(
    () =>
      managers
        .map((m) => ({ manager: m, ...getManagerStats(m.id, trips, bookings) }))
        .sort((a, b) => b.commission - a.commission),
    [managers, trips, bookings],
  )

  const upcoming = useMemo(
    () =>
      bookings
        .filter(
          (b) =>
            b.paidAmount < b.totalPrice &&
            b.dueDate >= TODAY &&
            b.dueDate <= IN_30_DAYS &&
            b.status !== "cancelled",
        )
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
    [bookings],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title={t("kpi.totalRevenue")}
          value={formatCurrency(totals.revenue, locale)}
          icon={<Wallet className="size-4" />}
        />
        <KpiCard
          title={t("kpi.outstanding")}
          value={formatCurrency(totals.outstanding, locale)}
          icon={<Clock className="size-4" />}
          tone="warn"
        />
        <KpiCard
          title={t("kpi.paidThisMonth")}
          value={formatCurrency(totals.paidThisMonth, locale)}
          icon={<CheckCircle2 className="size-4" />}
          tone="good"
        />
        <KpiCard
          title={t("kpi.commission")}
          value={formatCurrency(totals.commission, locale)}
          icon={<Percent className="size-4" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("charts.revenueTitle")}</CardTitle>
            <CardDescription>{t("charts.revenueSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("charts.paidVsOutstandingTitle")}</CardTitle>
            <CardDescription>{t("charts.paidVsOutstandingSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={paidVsOutstanding} barCategoryGap="20%">
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={60}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip
                  formatter={(v) =>
                    typeof v === "number" ? formatCurrency(v, locale) : String(v)
                  }
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Legend />
                <Bar
                  dataKey="paid"
                  stackId="pay"
                  fill="var(--chart-1)"
                  radius={[0, 0, 0, 0]}
                  name={t("charts.paid")}
                />
                <Bar
                  dataKey="outstanding"
                  stackId="pay"
                  fill="var(--chart-4)"
                  radius={[4, 4, 0, 0]}
                  name={t("charts.outstanding")}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("leaderboard.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("leaderboard.manager")}</TableHead>
                  <TableHead className="text-right">{t("leaderboard.bookings")}</TableHead>
                  <TableHead className="text-right">{t("leaderboard.revenue")}</TableHead>
                  <TableHead className="text-right">{t("leaderboard.commission")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((row) => (
                  <TableRow key={row.manager.id}>
                    <TableCell>
                      <Link
                        to={`/managers/${row.manager.id}`}
                        className="font-medium hover:underline"
                      >
                        {row.manager.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {tc(`managers:role.${row.manager.role}` as never, {
                          defaultValue: row.manager.role,
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.bookingsCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.revenue, locale)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(row.commission, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("upcoming.title")}</CardTitle>
            <CardDescription>{t("upcoming.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("upcoming.empty")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("upcoming.client")}</TableHead>
                    <TableHead>{t("upcoming.trip")}</TableHead>
                    <TableHead>{t("upcoming.dueDate")}</TableHead>
                    <TableHead className="text-right">{t("upcoming.balance")}</TableHead>
                    <TableHead>{t("upcoming.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcoming.slice(0, 12).map((b) => {
                    const c = clientById.get(b.clientId)
                    const trip = tripById.get(b.tripId)
                    return (
                      <TableRow key={b.id}>
                        <TableCell>
                          {c ? (
                            <Link
                              to={`/clients/${c.id}`}
                              className="hover:underline"
                            >
                              {c.firstName} {c.lastName}
                            </Link>
                          ) : (
                            b.clientId
                          )}
                        </TableCell>
                        <TableCell>
                          {trip ? (
                            <Link
                              to={`/trips/${trip.id}`}
                              className="hover:underline"
                            >
                              {trip.name}
                            </Link>
                          ) : (
                            b.tripId
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatDate(b.dueDate, locale)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(b.totalPrice - b.paidAmount, locale)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {tc(`bookingStatus.${b.status}`)}
                          </Badge>
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
    </div>
  )
}

function KpiCard({
  title,
  value,
  icon,
  tone = "neutral",
}: {
  title: string
  value: string
  icon: React.ReactNode
  tone?: "neutral" | "good" | "warn"
}) {
  const toneClass =
    tone === "good"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "bg-primary/10 text-primary"
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
          <div
            className={`flex size-9 items-center justify-center rounded-lg ${toneClass}`}
          >
            {icon}
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}
