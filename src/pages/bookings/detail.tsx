import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Mail, Phone } from "lucide-react"
import { Link, useParams } from "react-router"
import { toast } from "sonner"

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
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useBookingById } from "@/hooks/queries/use-bookings"
import { useClientById } from "@/hooks/queries/use-clients"
import { useManagers } from "@/hooks/queries/use-managers"
import { usePaymentsByBooking } from "@/hooks/queries/use-payments"
import { useTripById } from "@/hooks/queries/use-trips"
import { useUpdateBookingStatus } from "@/hooks/mutations/use-update-booking-status"
import { useHotels } from "@/hooks/queries/use-hotels"
import { formatCurrency, formatDate, formatDateRange } from "@/lib/format"
import type { BookingStatus } from "@/lib/booking-status"
import type { Locale } from "@/types"

// MIRROR of `private.bookings_assert_status_transition` in
// supabase/migrations/20260508900000_domain_rls.sql. The DB enforces
// transitions; this map only governs which buttons render. Keep in sync.
const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["partially_paid", "paid", "cancelled"],
  partially_paid: ["paid", "cancelled"],
  paid: ["no_show", "cancelled"],
  cancelled: [],
  no_show: [],
}

// Statuses that require a confirmation dialog before applying.
const DESTRUCTIVE_STATUSES = new Set<BookingStatus>(["cancelled", "no_show"])

function statusVariant(
  status: BookingStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "paid":
      return "default"
    case "partially_paid":
      return "secondary"
    case "confirmed":
      return "outline"
    case "cancelled":
    case "no_show":
      return "destructive"
    default:
      return "outline"
  }
}

export default function BookingDetailPage() {
  const { bookingId } = useParams()
  const { t, i18n } = useTranslation("booking")
  const { t: tc } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale

  const { data: booking, isLoading } = useBookingById(bookingId)
  const { data: client } = useClientById(booking?.clientId)
  const { data: trip } = useTripById(booking?.tripId)
  const { data: hotels = [] } = useHotels()
  const { data: managers = [] } = useManagers()
  const { data: payments = [] } = usePaymentsByBooking(bookingId)
  const updateStatus = useUpdateBookingStatus()

  // Pending confirmation: which target status we're about to apply.
  const [pendingStatus, setPendingStatus] = useState<BookingStatus | null>(null)

  const hotelById = useMemo(
    () => new Map(hotels.map((h) => [h.id, h])),
    [hotels],
  )
  const managerById = useMemo(
    () => new Map(managers.map((m) => [m.id, m])),
    [managers],
  )

  function handleTransition(target: BookingStatus) {
    if (DESTRUCTIVE_STATUSES.has(target)) {
      setPendingStatus(target)
    } else {
      applyTransition(target)
    }
  }

  function applyTransition(target: BookingStatus) {
    if (!bookingId) return
    updateStatus.mutate(
      { id: bookingId, status: target },
      {
        onSuccess: () => {
          toast.success(t("detail.statusChanged", { status: tc(`bookingStatus.${target}`) }))
        },
      },
    )
    setPendingStatus(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" render={<Link to="/" />}>
          <ArrowLeft className="size-4" />
          {t("detail.back")}
        </Button>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="space-y-2">
        <Button variant="ghost" size="sm" render={<Link to="/" />}>
          <ArrowLeft className="size-4" />
          {t("detail.back")}
        </Button>
        <p className="text-muted-foreground">{t("detail.notFound")}</p>
      </div>
    )
  }

  const outstanding = Math.max(0, booking.totalPrice - booking.paidAmount)
  const transitions = TRANSITIONS[booking.status] ?? []

  // Resolve dialog copy based on which destructive status is pending.
  const dialogKey = pendingStatus === "no_show" ? "noShowDialog" : "cancelDialog"

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <Button variant="ghost" size="sm" className="self-start" render={<Link to="/" />}>
        <ArrowLeft className="size-4" />
        {t("detail.back")}
      </Button>

      {/* Header */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tabular-nums">
              {t("detail.fields.booking")} #{booking.bookingNumber}
              {booking.contractNumber !== null && (
                <span className="ml-2 text-lg font-normal text-muted-foreground">
                  · {t("detail.fields.contract")}: #{booking.contractNumber}
                </span>
              )}
            </h1>
            <Badge variant={statusVariant(booking.status)}>
              {tc(`bookingStatus.${booking.status}`)}
            </Badge>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
            <div>
              <span className="text-muted-foreground">{t("detail.fields.total")}: </span>
              <span className="tabular-nums font-medium">
                {formatCurrency(booking.totalPrice, locale)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("detail.fields.paid")}: </span>
              <span className="tabular-nums font-medium">
                {formatCurrency(booking.paidAmount, locale)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("detail.fields.outstanding")}: </span>
              <span className="tabular-nums font-medium">
                {formatCurrency(outstanding, locale)}
              </span>
            </div>
          </div>

          {trip && (
            <p className="mt-1 text-sm text-muted-foreground">
              {trip.name}
              {" · "}
              {formatDateRange(trip.departureDate, trip.returnDate, locale)}
            </p>
          )}

          {client && (
            <p className="mt-1 text-sm text-muted-foreground">
              <Link to={`/clients/${client.id}`} className="font-medium hover:underline">
                {client.firstName} {client.lastName}
              </Link>
              {client.email && (
                <a
                  href={`mailto:${client.email}`}
                  className="ml-3 inline-flex items-center gap-1 hover:underline"
                >
                  <Mail className="size-3" />
                  {client.email}
                </a>
              )}
              {client.phone && (
                <a
                  href={`tel:${client.phone}`}
                  className="ml-3 inline-flex items-center gap-1 hover:underline"
                >
                  <Phone className="size-3" />
                  {client.phone}
                </a>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Status transitions */}
      {transitions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.sections.status")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {transitions.map((target) => (
                <Button
                  key={target}
                  variant={DESTRUCTIVE_STATUSES.has(target) ? "destructive" : "outline"}
                  size="sm"
                  disabled={updateStatus.isPending}
                  onClick={() => handleTransition(target)}
                >
                  {t(`detail.transitions.${transitionKey(target)}`)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passengers table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("detail.sections.passengers")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("detail.passengers.name")}</TableHead>
                <TableHead>{t("detail.passengers.kind")}</TableHead>
                <TableHead>{t("detail.passengers.seat")}</TableHead>
                <TableHead>{t("detail.passengers.hotel")}</TableHead>
                <TableHead>{t("detail.passengers.room")}</TableHead>
                <TableHead className="text-right">{t("detail.passengers.price")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {booking.passengers.map((p) => {
                const hotel = p.hotelId ? hotelById.get(p.hotelId) : undefined
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.firstName} {p.lastName}
                    </TableCell>
                    <TableCell>
                      {t(`detail.passengers.${p.kind}`)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {p.seatNumber ? `#${p.seatNumber}` : "—"}
                    </TableCell>
                    <TableCell>{hotel?.name ?? "—"}</TableCell>
                    <TableCell>
                      {p.roomType ? tc(`room.${p.roomType}`) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(p.price, locale)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payments table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("detail.sections.payments")}</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("detail.payments.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("detail.payments.date")}</TableHead>
                  <TableHead className="text-right">{t("detail.payments.amount")}</TableHead>
                  <TableHead>{t("detail.payments.method")}</TableHead>
                  <TableHead>{t("detail.payments.reference")}</TableHead>
                  <TableHead>{t("detail.payments.recordedBy")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((pay) => {
                  const recorder = pay.receivedByManagerId
                    ? managerById.get(pay.receivedByManagerId)
                    : undefined
                  return (
                    <TableRow key={pay.id}>
                      <TableCell className="tabular-nums">
                        {formatDate(pay.receivedAt, locale)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(pay.amountEur, locale)}
                      </TableCell>
                      <TableCell>
                        {t(`detail.payments.${pay.method}`)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {pay.reference ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {recorder?.name ?? "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirmation dialog for destructive transitions */}
      <Dialog open={pendingStatus !== null} onOpenChange={(open) => { if (!open) setPendingStatus(null) }} disablePointerDismissal>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t(`detail.${dialogKey}.title`)}</DialogTitle>
            <DialogDescription>
              {t(`detail.${dialogKey}.description`)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingStatus(null)}>
              {t(`detail.${dialogKey}.abort`)}
            </Button>
            <Button
              variant="destructive"
              disabled={updateStatus.isPending}
              onClick={() => { if (pendingStatus) applyTransition(pendingStatus) }}
            >
              {t(`detail.${dialogKey}.confirm`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Map a target BookingStatus to its i18n key in `detail.transitions.*` */
function transitionKey(status: BookingStatus): string {
  switch (status) {
    case "confirmed":
      return "confirm"
    case "partially_paid":
      return "markPartiallyPaid"
    case "paid":
      return "markPaid"
    case "cancelled":
      return "cancel"
    case "no_show":
      return "markNoShow"
    default:
      return status
  }
}
