import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { ArrowLeft, MapPin, Star } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
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
import { useBookings } from "@/hooks/queries/use-bookings"
import { useHotels } from "@/hooks/queries/use-hotels"
import { useTrips } from "@/hooks/queries/use-trips"
import { formatCurrency } from "@/lib/format"
import { getHotelStats } from "@/lib/stats"
import type { Booking, Locale, RoomType } from "@/types"

function bookingStatusVariant(
  s: Booking["status"],
): "default" | "secondary" | "outline" | "destructive" {
  switch (s) {
    case "paid":
      return "default"
    case "confirmed":
      return "secondary"
    case "cancelled":
      return "destructive"
    default:
      return "outline"
  }
}

import { useTripColumns } from "../trips/columns"

const ROOM_TYPES: RoomType[] = ["single", "double", "triple", "family"]

export default function HotelDetailPage() {
  const { hotelId } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation("hotels")
  const { t: tc } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale

  const { data: hotels = [] } = useHotels()
  const { data: trips = [] } = useTrips()
  const { data: bookings = [] } = useBookings()

  const hotel = useMemo(() => hotels.find((h) => h.id === hotelId), [hotels, hotelId])
  const stats = useMemo(
    () => (hotel ? getHotelStats(hotel.id, trips, bookings, hotels) : null),
    [hotel, trips, bookings, hotels],
  )
  const hotelTrips = useMemo(
    () => (hotel ? trips.filter((tr) => tr.hotelIds.includes(hotel.id)) : []),
    [hotel, trips],
  )
  type HotelPassengerRow = {
    key: string
    bookingId: string
    contractNumber: string
    passengerName: string
    tripId: string
    tripName: string
    roomType: RoomType
    status: Booking["status"]
    price: number
  }
  const hotelBookings = useMemo(
    () => (hotel ? bookings.filter((b) => b.passengers.some((p) => p.hotelId === hotel.id)) : []),
    [hotel, bookings],
  )
  const tripColumns = useTripColumns()
  const tripById = useMemo(() => new Map(trips.map((tr) => [tr.id, tr])), [trips])

  const hotelPassengerRows: HotelPassengerRow[] = useMemo(() => {
    if (!hotel) return []
    const rows: HotelPassengerRow[] = []
    for (const b of hotelBookings) {
      for (const p of b.passengers) {
        if (p.hotelId !== hotel.id) continue
        rows.push({
          key: p.id,
          bookingId: b.id,
          contractNumber: b.contractNumber,
          passengerName: `${p.firstName} ${p.lastName}`,
          tripId: b.tripId,
          tripName: tripById.get(b.tripId)?.name ?? b.tripId,
          roomType: p.roomType,
          status: b.status,
          price: p.price,
        })
      }
    }
    return rows
  }, [hotel, hotelBookings, tripById])

  const bookingColumns: ColumnDef<HotelPassengerRow>[] = useMemo(
    () => [
      {
        id: "client",
        header: t("columns.client"),
        cell: ({ row }) => row.original.passengerName,
      },
      {
        id: "trip",
        header: t("columns.trip"),
        cell: ({ row }) => row.original.tripName,
      },
      {
        id: "room",
        header: t("columns.room"),
        cell: ({ row }) => tc(`room.${row.original.roomType}`),
      },
      {
        id: "status",
        header: t("columns.status"),
        cell: ({ row }) => (
          <Badge variant={bookingStatusVariant(row.original.status)}>
            {tc(`bookingStatus.${row.original.status}` as never, {
              defaultValue: row.original.status,
            })}
          </Badge>
        ),
      },
      {
        id: "total",
        header: t("columns.total"),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatCurrency(row.original.price, locale)}
          </span>
        ),
      },
    ],
    [t, tc, locale],
  )

  if (!hotel || !stats) {
    return (
      <div className="space-y-2">
        <Button variant="ghost" size="sm" render={<Link to="/hotels" />}>
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
        <Button variant="ghost" size="sm" className="self-start" render={<Link to="/hotels" />}>
          <ArrowLeft className="size-4" />
          {t("title")}
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              {hotel.name}
              <span className="flex" aria-label={`${hotel.stars} stars`}>
                {Array.from({ length: hotel.stars }).map((_, i) => (
                  <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
                ))}
              </span>
            </h1>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" /> {hotel.city}, {hotel.country}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>{t("stats.totalRooms")}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{stats.totalRooms}</CardTitle>
          </CardHeader>
        </Card>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("rooms.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("rooms.type")}</TableHead>
                <TableHead className="text-right">{t("rooms.total")}</TableHead>
                <TableHead className="text-right">{t("rooms.price")}</TableHead>
                <TableHead className="text-right">{t("rooms.booked")}</TableHead>
                <TableHead>{t("rooms.occupancy")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROOM_TYPES.map((type) => {
                const room = hotel.rooms[type]
                const booked = stats.bookedByType[type] ?? 0
                const pct = room.total > 0 ? Math.round((booked / room.total) * 100) : 0
                return (
                  <TableRow key={type}>
                    <TableCell className="font-medium">{tc(`room.${type}`)}</TableCell>
                    <TableCell className="text-right tabular-nums">{room.total}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(room.pricePerNight, locale)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{booked}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="w-24" />
                        <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                          {pct}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sections.trips")}</CardTitle>
        </CardHeader>
        <CardContent>
          {hotelTrips.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("sections.noTrips")}</p>
          ) : (
            <DataTable
              columns={tripColumns}
              data={hotelTrips}
              emptyMessage={t("sections.noTrips")}
              onRowClick={(tr) => navigate(`/trips/${tr.id}`)}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sections.bookings")}</CardTitle>
        </CardHeader>
        <CardContent>
          {hotelPassengerRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("sections.noBookings")}</p>
          ) : (
            <DataTable
              columns={bookingColumns}
              data={hotelPassengerRows}
              emptyMessage={t("sections.noBookings")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
