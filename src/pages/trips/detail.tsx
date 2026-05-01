import { ArrowLeft, Bus, Calendar, MapPin, Pencil, PlusIcon, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { Skeleton } from "@/components/ui/skeleton"

import { SeatMap } from "@/components/bus/seat-map"
import { DataTable } from "@/components/data-table/data-table"
import { HotelCard } from "@/components/hotel/hotel-card"
import { HotelBlockFormDialog } from "@/components/trips/hotel-block-form-dialog"
import { TripFormDialog } from "@/components/trips/trip-form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useBookingsByTrip } from "@/hooks/queries/use-bookings"
import { useHotelBlocks } from "@/hooks/queries/use-hotel-blocks"
import type { HotelBlock } from "@/hooks/queries/use-hotel-blocks"
import { useHotels } from "@/hooks/queries/use-hotels"
import { useTripById } from "@/hooks/queries/use-trips"
import { useDeleteHotelBlock } from "@/hooks/mutations/use-delete-hotel-block"
import { formatCurrency, formatDateRange } from "@/lib/format"
import type { Locale, RoomType } from "@/types"

export default function TripDetailPage() {
  const { tripId } = useParams()
  const { t, i18n } = useTranslation("trips")
  const { t: tc } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale

  const [editOpen, setEditOpen] = useState(false)
  const [blockCreateOpen, setBlockCreateOpen] = useState(false)
  const [blockEditTarget, setBlockEditTarget] = useState<HotelBlock | null>(null)
  const [blockDeleteTarget, setBlockDeleteTarget] = useState<HotelBlock | null>(null)

  const { data: trip, isLoading: tripLoading } = useTripById(tripId)
  const { data: tripBookings = [] } = useBookingsByTrip(tripId)
  const { data: hotels = [] } = useHotels()
  const { data: hotelBlocks = [] } = useHotelBlocks(tripId)
  const deleteBlock = useDeleteHotelBlock()

  const tripHotels = useMemo(
    () => (trip ? hotels.filter((h) => trip.hotelIds.includes(h.id)) : []),
    [trip, hotels],
  )
  if (tripLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" render={<Link to="/trips" />}>
          <ArrowLeft className="size-4" />
          {t("title")}
        </Button>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }
  if (!trip) {
    return (
      <div className="space-y-2">
        <Button variant="ghost" size="sm" render={<Link to="/trips" />}>
          <ArrowLeft className="size-4" />
          {t("title")}
        </Button>
        <p className="text-muted-foreground">{t("notFound")}</p>
      </div>
    )
  }

  type PassengerRow = {
    key: string
    displayNumber: string
    seatNumber: number
    name: string
    room: string
    price: number
    bookingId: string
  }
  const passengerRows: PassengerRow[] = tripBookings.flatMap((b) =>
    b.passengers.map((p) => ({
      key: p.id,
      displayNumber: b.contractNumber ?? b.bookingNumber,
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
      header: t("passengers.columns.seat"),
      cell: ({ row }) => <span className="tabular-nums">#{row.original.seatNumber}</span>,
    },
    {
      id: "contract",
      header: t("passengers.columns.contract"),
      cell: ({ row }) => (
        <Link
          to={`/bookings/${row.original.bookingId}`}
          className="tabular-nums hover:underline"
        >
          {row.original.displayNumber}
        </Link>
      ),
    },
    {
      id: "name",
      header: t("tabs.clients"),
      cell: ({ row }) => row.original.name,
    },
    {
      id: "room",
      header: t("passengers.columns.room"),
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
      <TripFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initialTrip={trip}
      />

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
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              {t("details.edit")}
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="bus">
        <TabsList>
          <TabsTrigger value="bus">{t("tabs.bus")}</TabsTrigger>
          <TabsTrigger value="hotels">{t("tabs.hotels")}</TabsTrigger>
          <TabsTrigger value="clients">{t("tabs.clients")}</TabsTrigger>
          <TabsTrigger value="blocks">{t("tabs.blocks")}</TabsTrigger>
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

        <TabsContent value="blocks" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("blocks.title")}</CardTitle>
                <Button size="sm" onClick={() => setBlockCreateOpen(true)}>
                  <PlusIcon className="size-4" />
                  {t("blocks.addCta")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {hotelBlocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("blocks.empty")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">{t("blocks.columns.hotel")}</th>
                        <th className="pb-2 pr-4 font-medium">{t("blocks.columns.roomType")}</th>
                        <th className="pb-2 pr-4 font-medium">{t("blocks.columns.used")}</th>
                        <th className="pb-2 pr-4 font-medium">{t("blocks.columns.notes")}</th>
                        <th className="pb-2 font-medium">{t("blocks.columns.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hotelBlocks.map((block) => {
                        const hotel = hotels.find((h) => h.id === block.hotel_id)
                        return (
                          <tr key={block.id} className="border-b last:border-0">
                            <td className="py-2 pr-4">
                              {hotel ? (
                                <span>
                                  {hotel.name}
                                  <span className="ml-1 text-muted-foreground">{hotel.city}</span>
                                </span>
                              ) : (
                                <span className="text-muted-foreground">{block.hotel_id}</span>
                              )}
                            </td>
                            <td className="py-2 pr-4">{tc(`room.${block.room_type}`)}</td>
                            <td className="py-2 pr-4 tabular-nums">
                              {block.qty_used} / {block.qty_total}
                            </td>
                            <td className="max-w-[200px] truncate py-2 pr-4 text-muted-foreground">
                              {block.notes ?? "—"}
                            </td>
                            <td className="py-2">
                              <div className="flex items-center gap-1">
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label={tc("actions.edit")}
                                  onClick={() => setBlockEditTarget(block)}
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label={tc("actions.delete")}
                                  onClick={() => setBlockDeleteTarget(block)}
                                >
                                  <Trash2 className="size-3.5 text-destructive" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Hotel block — create dialog */}
      <HotelBlockFormDialog
        open={blockCreateOpen}
        onOpenChange={setBlockCreateOpen}
        mode="create"
        tripId={trip.id}
      />

      {/* Hotel block — edit dialog */}
      <HotelBlockFormDialog
        open={blockEditTarget !== null}
        onOpenChange={(open) => { if (!open) setBlockEditTarget(null) }}
        mode="edit"
        tripId={trip.id}
        initialBlock={blockEditTarget ?? undefined}
      />

      {/* Hotel block — delete confirmation */}
      <Dialog
        open={blockDeleteTarget !== null}
        onOpenChange={(open) => { if (!open) setBlockDeleteTarget(null) }}
        disablePointerDismissal
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("blocks.deleteDialog.title")}</DialogTitle>
            <DialogDescription>{t("blocks.deleteDialog.body")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDeleteTarget(null)}>
              {t("blocks.deleteDialog.abort")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteBlock.isPending}
              onClick={() => {
                if (!blockDeleteTarget) return
                deleteBlock.mutate(
                  { id: blockDeleteTarget.id, tripId: trip.id },
                  {
                    onSuccess: () => {
                      toast.success(t("blocks.dialog.success.deleted"))
                      setBlockDeleteTarget(null)
                    },
                    onError: (err) => {
                      toast.error(err.message)
                    },
                  },
                )
              }}
            >
              {t("blocks.deleteDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
