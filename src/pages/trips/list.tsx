import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"

import { DataTable } from "@/components/data-table/data-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { trips } from "@/data"
import { ALL_TRIP_STATUSES } from "@/lib/trip-status"

import { useTripColumns } from "./columns"

export default function TripsListPage() {
  const { t } = useTranslation("trips")
  const { t: tc } = useTranslation()
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

  const columns = useTripColumns()

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
                {ALL_TRIP_STATUSES.map((s) => (
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
