import { ArrowLeft, Bus, Calendar, MapPin } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router"
import type { ColumnDef } from "@tanstack/react-table"

import { SeatMap } from "@/components/bus/seat-map"
import { DataTable } from "@/components/data-table/data-table"
import { HotelCard } from "@/components/hotel/hotel-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useBookingsByTrip } from "@/hooks/queries/use-bookings"
import { useHotels } from "@/hooks/queries/use-hotels"
import { useTripById } from "@/hooks/queries/use-trips"
import { formatCurrency, formatDateRange } from "@/lib/format"
import type { Locale, RoomType } from "@/types"

export default function TripDetailPage() {
  const { tripId } = useParams()
  const { t, i18n } = useTranslation("trips")
  const { t: tc } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale

  const { data: trip } = useTripById(tripId)
  const { data: tripBookings = [] } = useBookingsByTrip(tripId)
  const { data: hotels = [] } = useHotels()

  const tripHotels = useMemo(
    () => (trip ? hotels.filter((h) => trip.hotelIds.includes(h.id)) : []),
    [trip, hotels],
  )
  if (!trip) {
    return (
      <div className="space-y-2">
        <Button variant="ghost" size="sm" render={<Link to="/trips" />}>
          <ArrowLeft className="size-4" />
          {t("title")}
        </Button>
        <p className="text-muted-foreground">Trip not found.</p>
      </div>
    )
  }

  type PassengerRow = {
    key: string
    contractNumber: string
    seatNumber: number
    name: string
    room: string
    price: number
    bookingId: string
  }
  const passengerRows: PassengerRow[] = tripBookings.flatMap((b) =>
    b.passengers.map((p) => ({
      key: p.id,
      contractNumber: b.contractNumber,
      seatNumber: p.seatNumber,
      name: `${p.firstName} ${p.lastName}`,
      room: p.roomType,
      price: p.price,
      bookingId: b.id,
    })),
  )
  passengerRows.sort((a, b) => a.seatNumber - b.seatNumber)

  const passengerCols: ColumnDef<PassengerRow>[] = [
    {
      id: "seat",
      header: "Seat",
      cell: ({ row }) => <span className="tabular-nums">#{row.original.seatNumber}</span>,
    },
    {
      id: "contract",
      header: "Contract",
      cell: ({ row }) => <span className="tabular-nums">{row.original.contractNumber}</span>,
    },
    {
      id: "name",
      header: t("tabs.clients"),
      cell: ({ row }) => row.original.name,
    },
    {
      id: "room",
      header: "Room",
      cell: ({ row }) => tc(`room.${row.original.room}`),
    },
    {
      id: "price",
      header: t("columns.price"),
      cell: ({ row }) => (
        <span className="tabular-nums">{formatCurrency(row.original.price, locale)}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="self-start" render={<Link to="/trips" />}>
          <ArrowLeft className="size-4" />
          {t("title")}
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{trip.name}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" /> {trip.origin} → {trip.destination}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5" />
                {formatDateRange(trip.departureDate, trip.returnDate, locale)}
              </span>
              <span className="flex items-center gap-1">
                <Bus className="size-3.5" /> {t(`bus.${trip.busType}`)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{formatCurrency(trip.basePrice, locale)}</Badge>
            <Badge>{tc(`status.${trip.status}`)}</Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="bus">
        <TabsList>
          <TabsTrigger value="bus">{t("tabs.bus")}</TabsTrigger>
          <TabsTrigger value="hotels">{t("tabs.hotels")}</TabsTrigger>
          <TabsTrigger value="clients">{t("tabs.clients")}</TabsTrigger>
        </TabsList>

        <TabsContent value="bus" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("tabs.bus")}</CardTitle>
            </CardHeader>
            <CardContent>
              <SeatMap busType={trip.busType} tripId={trip.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hotels" className="mt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tripHotels.map((h) => {
              const bookedByType: Partial<Record<RoomType, number>> = {}
              for (const b of tripBookings) {
                for (const p of b.passengers) {
                  if (p.hotelId !== h.id) continue
                  bookedByType[p.roomType] = (bookedByType[p.roomType] ?? 0) + 1
                }
              }
              return <HotelCard key={h.id} hotel={h} bookedByType={bookedByType} />
            })}
          </div>
        </TabsContent>

        <TabsContent value="clients" className="mt-4">
          <DataTable
            columns={passengerCols}
            data={passengerRows}
            emptyMessage={t("empty")}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
