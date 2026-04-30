import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { ArrowRight } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table/data-table"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useBookings } from "@/hooks/queries/use-bookings"
import { useClients } from "@/hooks/queries/use-clients"
import { useTrips } from "@/hooks/queries/use-trips"
import { formatCurrency, formatDate } from "@/lib/format"
import type { Client, Locale } from "@/types"

interface EnrichedClient extends Client {
  bookingsCount: number
  lastTripName: string | null
  lastTripDate: Date | null
}

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase()
}

export default function ClientsListPage() {
  const { t, i18n } = useTranslation("clients")
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale
  const [openId, setOpenId] = useState<string | null>(null)

  const { data: clients = [] } = useClients()
  const { data: bookings = [] } = useBookings()
  const { data: trips = [] } = useTrips()

  const enriched: EnrichedClient[] = useMemo(() => {
    const tripById = new Map(trips.map((tr) => [tr.id, tr]))
    return clients.map((c) => {
      const clientBookings = bookings.filter((b) => b.clientId === c.id)
      const last = clientBookings
        .map((b) => tripById.get(b.tripId))
        .filter((tr): tr is NonNullable<typeof tr> => Boolean(tr))
        .sort((a, b) => b.departureDate.getTime() - a.departureDate.getTime())[0]
      return {
        ...c,
        bookingsCount: clientBookings.length,
        lastTripName: last?.name ?? null,
        lastTripDate: last?.departureDate ?? null,
      }
    })
  }, [clients, bookings, trips])

  const columns: ColumnDef<EnrichedClient>[] = useMemo(
    () => [
      {
        id: "name",
        accessorFn: (row) => `${row.firstName} ${row.lastName}`,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("columns.name")} />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">
                {initials(row.original.firstName, row.original.lastName)}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium">
              {row.original.firstName} {row.original.lastName}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "nationality",
        header: t("columns.nationality"),
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.nationality === "UA" ? "🇺🇦 UA" : "🇩🇪 DE"}</Badge>
        ),
      },
      {
        accessorKey: "email",
        header: t("columns.email"),
        cell: ({ row }) => <span className="text-sm">{row.original.email}</span>,
      },
      {
        accessorKey: "phone",
        header: t("columns.phone"),
        cell: ({ row }) => <span className="text-sm">{row.original.phone}</span>,
      },
      {
        accessorKey: "bookingsCount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("columns.bookings")} />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.bookingsCount}</span>
        ),
      },
      {
        id: "lastTrip",
        header: t("columns.lastTrip"),
        cell: ({ row }) =>
          row.original.lastTripName ? (
            <div className="text-sm">
              <div>{row.original.lastTripName}</div>
              <div className="text-xs text-muted-foreground">
                {row.original.lastTripDate &&
                  formatDate(row.original.lastTripDate, locale)}
              </div>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
    ],
    [t, locale],
  )

  const openClient = useMemo(
    () => enriched.find((c) => c.id === openId) ?? null,
    [openId, enriched],
  )

  const openClientBookings = useMemo(() => {
    if (!openClient) return []
    const tripById = new Map(trips.map((tr) => [tr.id, tr]))
    return bookings
      .filter((b) => b.clientId === openClient.id)
      .map((b) => ({ ...b, trip: tripById.get(b.tripId) ?? null }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }, [openClient, bookings, trips])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <DataTable
        columns={columns}
        data={enriched}
        searchColumn="name"
        searchPlaceholder={t("search")}
        emptyMessage={t("empty")}
        onRowClick={(c) => setOpenId(c.id)}
      />

      <Sheet open={openId !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
          {openClient && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {initials(openClient.firstName, openClient.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <SheetTitle>
                      {openClient.firstName} {openClient.lastName}
                    </SheetTitle>
                    <SheetDescription>
                      {openClient.nationality === "UA" ? "🇺🇦" : "🇩🇪"} {openClient.email}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <Separator />
              <dl className="grid grid-cols-[120px_1fr] gap-y-2 px-4 text-sm">
                <dt className="text-muted-foreground">{t("columns.phone")}</dt>
                <dd>{openClient.phone}</dd>
                <dt className="text-muted-foreground">{t("details.birthDate")}</dt>
                <dd>{formatDate(openClient.birthDate, locale)}</dd>
                <dt className="text-muted-foreground">{t("details.createdAt")}</dt>
                <dd>{formatDate(openClient.createdAt, locale)}</dd>
              </dl>
              <Separator />
              <div className="px-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  render={<Link to={`/clients/${openClient.id}`} />}
                >
                  {t("details.openFull")}
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
              <Separator />
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <h3 className="mb-2 font-medium">{t("details.bookingHistory")}</h3>
                {openClientBookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("details.noBookings")}</p>
                ) : (
                  <ul className="space-y-2">
                    {openClientBookings.map((b) => (
                      <li key={b.id} className="rounded-md border p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{b.trip?.name ?? b.tripId}</span>
                          <span className="tabular-nums">
                            {formatCurrency(b.totalPrice, locale)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {b.trip && formatDate(b.trip.departureDate, locale)} · Seats{" "}
                          {b.passengers.map((p) => p.seatNumber).join(", ")}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
