import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table/data-table"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { trips } from "@/data"
import { formatCurrency, formatDate } from "@/lib/format"
import type { Locale, Trip, TripStatus } from "@/types"

const STATUSES: TripStatus[] = [
  "planned",
  "booking",
  "confirmed",
  "in-progress",
  "completed",
  "cancelled",
]

function statusVariant(s: TripStatus): "default" | "secondary" | "outline" | "destructive" {
  switch (s) {
    case "confirmed":
    case "in-progress":
      return "default"
    case "booking":
      return "secondary"
    case "cancelled":
      return "destructive"
    default:
      return "outline"
  }
}

export default function TripsListPage() {
  const { t, i18n } = useTranslation("trips")
  const { t: tc } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale
  const navigate = useNavigate()

  const [destination, setDestination] = useState<string>("all")
  const [status, setStatus] = useState<string>("all")

  const destinations = useMemo(
    () => [...new Set(trips.map((tr) => tr.destination))].sort(),
    [],
  )

  const filtered = useMemo(
    () =>
      trips.filter(
        (tr) =>
          (destination === "all" || tr.destination === destination) &&
          (status === "all" || tr.status === status),
      ),
    [destination, status],
  )

  const columns: ColumnDef<Trip>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("columns.name")} />
        ),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: "route",
        header: t("columns.route"),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.origin} → {row.original.destination}
          </span>
        ),
      },
      {
        accessorKey: "departureDate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("columns.departure")} />
        ),
        cell: ({ row }) => formatDate(row.original.departureDate, locale),
        sortingFn: (a, b) =>
          a.original.departureDate.getTime() - b.original.departureDate.getTime(),
      },
      {
        accessorKey: "busType",
        header: t("columns.busType"),
        cell: ({ row }) => <Badge variant="outline">{t(`bus.${row.original.busType}`)}</Badge>,
      },
      {
        id: "occupancy",
        header: t("columns.occupancy"),
        cell: ({ row }) => {
          const percent = Math.round((row.original.bookedCount / row.original.capacity) * 100)
          return (
            <div className="flex items-center gap-2">
              <Progress value={percent} className="w-20" />
              <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
                {row.original.bookedCount}/{row.original.capacity}
              </span>
            </div>
          )
        },
      },
      {
        accessorKey: "status",
        header: t("columns.status"),
        cell: ({ row }) => (
          <Badge variant={statusVariant(row.original.status)}>
            {tc(`status.${row.original.status}`)}
          </Badge>
        ),
        filterFn: (row, _, value) =>
          !value || value === "all" || row.original.status === value,
      },
      {
        accessorKey: "basePrice",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("columns.price")} />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatCurrency(row.original.basePrice, locale)}</span>
        ),
      },
    ],
    [t, tc, locale],
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchColumn="name"
        searchPlaceholder={t("search")}
        emptyMessage={t("empty")}
        onRowClick={(tr) => navigate(`/trips/${tr.id}`)}
        toolbarExtra={
          <>
            <Select
              value={destination}
              onValueChange={(v) => {
                if (v) setDestination(v)
              }}
            >
              <SelectTrigger size="sm" className="h-9 w-[180px]">
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
            <Select
              value={status}
              onValueChange={(v) => {
                if (v) setStatus(v)
              }}
            >
              <SelectTrigger size="sm" className="h-9 w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filters.allStatuses")}</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {tc(`status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
    </div>
  )
}
