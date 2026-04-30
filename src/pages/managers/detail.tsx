import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Mail, Phone } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table/data-table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useBookings } from "@/hooks/queries/use-bookings"
import { useClients } from "@/hooks/queries/use-clients"
import { useManagers } from "@/hooks/queries/use-managers"
import { useTrips } from "@/hooks/queries/use-trips"
import { formatCurrency, formatDate } from "@/lib/format"
import { getManagerStats } from "@/lib/stats"
import type { Booking, Locale } from "@/types"

import { useTripColumns } from "../trips/columns"

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export default function ManagerDetailPage() {
  const { managerId } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation("managers")
  const { t: tc } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale

  const { data: managers = [] } = useManagers()
  const { data: trips = [] } = useTrips()
  const { data: bookings = [] } = useBookings()
  const { data: clients = [] } = useClients()

  const manager = useMemo(() => managers.find((m) => m.id === managerId), [managers, managerId])
  const stats = useMemo(
    () => (manager ? getManagerStats(manager.id, trips, bookings) : null),
    [manager, trips, bookings],
  )
  const mgrTrips = useMemo(
    () => (manager ? trips.filter((tr) => tr.managerId === manager.id) : []),
    [manager, trips],
  )
  const mgrBookings = useMemo(
    () => (manager ? bookings.filter((b) => b.managerId === manager.id) : []),
    [manager, bookings],
  )

  const tripColumns = useTripColumns()
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])
  const tripById = useMemo(() => new Map(trips.map((tr) => [tr.id, tr])), [trips])

  const bookingColumns: ColumnDef<Booking>[] = useMemo(
    () => [
      {
        id: "client",
        header: tc("clients:columns.name"),
        cell: ({ row }) => {
          const c = clientById.get(row.original.clientId)
          return c ? `${c.firstName} ${c.lastName}` : row.original.clientId
        },
      },
      {
        id: "trip",
        header: tc("trips:columns.name"),
        cell: ({ row }) => tripById.get(row.original.tripId)?.name ?? row.original.tripId,
      },
      {
        id: "createdAt",
        header: tc("dashboard:recent.date"),
        cell: ({ row }) => formatDate(row.original.createdAt, locale),
      },
      {
        id: "status",
        header: tc("hotels:columns.status"),
        cell: ({ row }) => (
          <Badge variant="outline">{tc(`bookingStatus.${row.original.status}`)}</Badge>
        ),
      },
      {
        id: "total",
        header: tc("trips:columns.price"),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatCurrency(row.original.totalPrice, locale)}</span>
        ),
      },
    ],
    [tc, clientById, tripById, locale],
  )

  if (!manager || !stats) {
    return (
      <div className="space-y-2">
        <Button variant="ghost" size="sm" render={<Link to="/managers" />}>
          <ArrowLeft className="size-4" />
          {t("title")}
        </Button>
        <p className="text-muted-foreground">{t("notFound")}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="self-start" render={<Link to="/managers" />}>
          <ArrowLeft className="size-4" />
          {t("title")}
        </Button>
        <div className="flex flex-wrap items-start gap-4">
          <Avatar size="lg">
            <AvatarFallback>{initials(manager.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              {manager.name}
              <Badge variant={manager.role === "owner" ? "default" : "outline"}>
                {t(`role.${manager.role}`)}
              </Badge>
            </h1>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="size-3.5" />
                {manager.email}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="size-3.5" />
                {manager.phone}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>{t("stats.trips")}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{stats.tripsCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t("stats.bookings")}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{stats.bookingsCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t("stats.revenue")}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCurrency(stats.revenue, locale)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t("stats.commission")}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCurrency(stats.commission, locale)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">{t("sections.trips")}</h2>
        {mgrTrips.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("sections.noTrips")}</p>
        ) : (
          <DataTable
            columns={tripColumns}
            data={mgrTrips}
            emptyMessage={t("sections.noTrips")}
            onRowClick={(tr) => navigate(`/trips/${tr.id}`)}
          />
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">{t("sections.bookings")}</h2>
        {mgrBookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("sections.noBookings")}</p>
        ) : (
          <DataTable
            columns={bookingColumns}
            data={mgrBookings}
            emptyMessage={t("sections.noBookings")}
          />
        )}
      </div>
    </div>
  )
}
