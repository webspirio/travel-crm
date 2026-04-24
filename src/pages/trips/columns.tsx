import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { formatCurrency, formatDate } from "@/lib/format"
import { tripStatusVariant } from "@/lib/trip-status"
import type { Locale, Trip } from "@/types"

export function useTripColumns(): ColumnDef<Trip>[] {
  const { t, i18n } = useTranslation("trips")
  const { t: tc } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale

  return useMemo(
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
          const percent = Math.round(
            (row.original.bookedCount / row.original.capacity) * 100,
          )
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
          <Badge variant={tripStatusVariant(row.original.status)}>
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
          <span className="tabular-nums">
            {formatCurrency(row.original.basePrice, locale)}
          </span>
        ),
      },
    ],
    [t, tc, locale],
  )
}
