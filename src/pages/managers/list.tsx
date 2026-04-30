import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table/data-table"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useBookings } from "@/hooks/queries/use-bookings"
import { useManagers } from "@/hooks/queries/use-managers"
import { useTrips } from "@/hooks/queries/use-trips"
import { formatCurrency } from "@/lib/format"
import { getManagerStats } from "@/lib/stats"
import type { Locale, Manager } from "@/types"

interface ManagerRow extends Manager {
  tripsCount: number
  bookingsCount: number
  revenue: number
  commission: number
  conversionPercent: number
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export default function ManagersListPage() {
  const { t, i18n } = useTranslation("managers")
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale
  const navigate = useNavigate()

  const { data: managers = [] } = useManagers()
  const { data: trips = [] } = useTrips()
  const { data: bookings = [] } = useBookings()

  const rows: ManagerRow[] = useMemo(
    () =>
      managers.map((m) => ({
        ...m,
        ...getManagerStats(m.id, trips, bookings),
      })),
    [managers, trips, bookings],
  )

  const columns: ColumnDef<ManagerRow>[] = useMemo(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.name,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("columns.name")} />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">{initials(row.original.name)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{row.original.name}</div>
              <div className="text-xs text-muted-foreground">{row.original.email}</div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: t("columns.role"),
        cell: ({ row }) => (
          <Badge variant={row.original.role === "owner" ? "default" : "outline"}>
            {t(`role.${row.original.role}`)}
          </Badge>
        ),
      },
      {
        accessorKey: "tripsCount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("columns.trips")} />
        ),
        cell: ({ row }) => <span className="tabular-nums">{row.original.tripsCount}</span>,
      },
      {
        accessorKey: "bookingsCount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("columns.bookings")} />
        ),
        cell: ({ row }) => <span className="tabular-nums">{row.original.bookingsCount}</span>,
      },
      {
        accessorKey: "revenue",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("columns.revenue")} />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatCurrency(row.original.revenue, locale)}</span>
        ),
      },
      {
        accessorKey: "commission",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("columns.commission")} />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">
            {formatCurrency(row.original.commission, locale)}
          </span>
        ),
      },
      {
        accessorKey: "conversionPercent",
        header: t("columns.conversion"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Progress value={row.original.conversionPercent} className="w-20" />
            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
              {row.original.conversionPercent}%
            </span>
          </div>
        ),
      },
    ],
    [t, locale],
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        searchColumn="name"
        searchPlaceholder={t("search")}
        emptyMessage={t("empty")}
        onRowClick={(row) => navigate(`/managers/${row.id}`)}
      />
    </div>
  )
}
