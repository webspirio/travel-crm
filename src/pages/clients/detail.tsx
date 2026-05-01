import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Mail, MapPin, Pencil, Phone, Star } from "lucide-react"
import { Link, useParams } from "react-router"
import { toast } from "sonner"

import { ClientFormDialog } from "@/components/clients/client-form-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useUpdateClient } from "@/hooks/mutations/use-update-client"
import { useBookingsByClient } from "@/hooks/queries/use-bookings"
import { useClientById } from "@/hooks/queries/use-clients"
import { useHotels } from "@/hooks/queries/use-hotels"
import { useTrips } from "@/hooks/queries/use-trips"
import { formatCurrency, formatDate } from "@/lib/format"
import { getClientStats } from "@/lib/stats"
import type { Locale } from "@/types"

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase()
}

export default function ClientDetailPage() {
  const { clientId } = useParams()
  const { t, i18n } = useTranslation("clients")
  const { t: tc } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale

  const { data: client, isLoading: clientLoading } = useClientById(clientId)
  const { data: trips = [] } = useTrips()
  const { data: hotels = [] } = useHotels()
  const { data: bookings = [] } = useBookingsByClient(clientId)

  const stats = useMemo(
    () => (client ? getClientStats(client.id, trips, bookings, hotels) : null),
    [client, trips, bookings, hotels],
  )
  const clientBookings = useMemo(() => {
    if (!client) return []
    const tripById = new Map(trips.map((tr) => [tr.id, tr]))
    const hotelById = new Map(hotels.map((h) => [h.id, h]))
    return bookings
      .map((b) => {
        const firstHotelId = b.passengers[0]?.hotelId
        const firstRoom = b.passengers[0]?.roomType
        const seatList = b.passengers.map((p) => p.seatNumber).join(", ")
        return {
          ...b,
          trip: tripById.get(b.tripId) ?? null,
          hotel: firstHotelId ? hotelById.get(firstHotelId) ?? null : null,
          firstRoom,
          seatList,
        }
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }, [client, trips, hotels, bookings])

  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const updateClient = useUpdateClient()
  const persistedNote = client?.notes ?? ""
  const [draftNote, setDraftNote] = useState(persistedNote)
  const [lastPersisted, setLastPersisted] = useState(persistedNote)
  // Sync draft when the server value changes (e.g. after a successful mutation
  // invalidates the cache and the query refetches with the updated notes).
  // This render-time state update avoids an extra render cycle.
  if (lastPersisted !== persistedNote) {
    setLastPersisted(persistedNote)
    setDraftNote(persistedNote)
  }

  if (clientLoading) {
    return (
      <div className="space-y-2">
        <Button variant="ghost" size="sm" render={<Link to="/clients" />}>
          <ArrowLeft className="size-4" />
          {t("title")}
        </Button>
        <p className="text-muted-foreground">{tc("loading")}</p>
      </div>
    )
  }
  if (!client || !stats) {
    return (
      <div className="space-y-2">
        <Button variant="ghost" size="sm" render={<Link to="/clients" />}>
          <ArrowLeft className="size-4" />
          {t("title")}
        </Button>
        <p className="text-muted-foreground">{t("empty")}</p>
      </div>
    )
  }

  const saveNote = () => {
    updateClient.mutate(
      { id: client.id, patch: { notes: draftNote } },
      {
        onSuccess: () => toast.success(t("profile.notesSaved")),
        onError: (err) => toast.error(err.message),
      },
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="self-start" render={<Link to="/clients" />}>
          <ArrowLeft className="size-4" />
          {t("profile.back")}
        </Button>
        <div className="flex flex-wrap items-start gap-4">
          <Avatar size="lg">
            <AvatarFallback>{initials(client.firstName, client.lastName)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="flex items-center gap-2 text-2xl font-semibold">
                {client.firstName} {client.lastName}
                <Badge variant="outline">
                  {client.nationality === "UA" ? "🇺🇦 UA" : "🇩🇪 DE"}
                </Badge>
              </h1>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditDialogOpen(true)}
              >
                <Pencil className="size-3.5" />
                {t("details.edit")}
              </Button>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="size-3.5" /> {client.email}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="size-3.5" /> {client.phone}
              </span>
              <span>
                {t("details.birthDate")}: {formatDate(client.birthDate, locale)}
              </span>
              <span>
                {t("details.createdAt")}: {formatDate(client.createdAt, locale)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>{t("profile.totalSpend")}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCurrency(stats.totalSpend, locale)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t("profile.bookingsCount")}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{stats.bookingsCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t("profile.lastTrip")}</CardDescription>
            <CardTitle className="text-base">
              {stats.lastTrip ? (
                <Link to={`/trips/${stats.lastTrip.id}`} className="hover:underline">
                  {stats.lastTrip.name}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </CardTitle>
            {stats.lastTrip && (
              <CardDescription>
                {formatDate(stats.lastTrip.departureDate, locale)}
              </CardDescription>
            )}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t("profile.upcomingTrip")}</CardDescription>
            <CardTitle className="text-base">
              {stats.upcomingTrip ? (
                <Link to={`/trips/${stats.upcomingTrip.id}`} className="hover:underline">
                  {stats.upcomingTrip.name}
                </Link>
              ) : (
                <span className="text-muted-foreground">{t("profile.noUpcoming")}</span>
              )}
            </CardTitle>
            {stats.upcomingTrip && (
              <CardDescription>
                {formatDate(stats.upcomingTrip.departureDate, locale)}
              </CardDescription>
            )}
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.preferredHotels")}</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.preferredHotels.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("profile.noPreferredHotels")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {stats.preferredHotels.map(({ hotel, count }) => (
                <Link
                  key={hotel.id}
                  to={`/hotels/${hotel.id}`}
                  className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-sky-200 to-blue-400 text-xl dark:from-sky-800 dark:to-blue-950">
                    🏨
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{hotel.name}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" /> {hotel.city}
                      <span className="ml-auto flex">
                        {Array.from({ length: hotel.stars }).map((_, i) => (
                          <Star key={i} className="size-3 fill-amber-400 text-amber-400" />
                        ))}
                      </span>
                    </div>
                  </div>
                  <Badge variant="secondary">× {count}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.timeline")}</CardTitle>
        </CardHeader>
        <CardContent>
          {clientBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("details.noBookings")}</p>
          ) : (
            <ol className="relative space-y-4 border-l pl-6">
              {clientBookings.map((b) => (
                <li key={b.id} className="relative">
                  <span className="absolute -left-[26px] top-1 size-3 rounded-full border-2 border-background bg-primary" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/bookings/${b.id}`} className="font-medium hover:underline">
                      {b.trip?.name ?? b.tripId}
                    </Link>
                    <Badge variant="outline">{tc(`bookingStatus.${b.status}`)}</Badge>
                    <span className="ml-auto tabular-nums font-medium">
                      {formatCurrency(b.totalPrice, locale)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {b.trip && formatDate(b.trip.departureDate, locale)} · {b.hotel?.name ?? "—"}
                    {b.firstRoom && ` · ${tc(`room.${b.firstRoom}`)}`}
                    {b.seatList && ` · Seats ${b.seatList}`}
                    {b.passengers.length > 1 && ` · ${b.passengers.length} pax`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(b.createdAt, locale)}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.notes")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={4}
            placeholder={t("profile.notesPlaceholder")}
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={saveNote}
              disabled={draftNote === persistedNote || updateClient.isPending}
            >
              {t("profile.notesSave")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ClientFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        mode="edit"
        initialClient={client}
      />
    </div>
  )
}
