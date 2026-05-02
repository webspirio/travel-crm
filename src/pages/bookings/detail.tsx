import { useMemo, useState } from "react"
import { ContactEditSheet } from "@/components/bookings/edit-sheets/contact-edit-sheet"
import { HotelsRoomsEditSheet } from "@/components/bookings/edit-sheets/hotels-rooms-edit-sheet"
import { NotesEditSheet } from "@/components/bookings/edit-sheets/notes-edit-sheet"
import { PassengersEditSheet } from "@/components/bookings/edit-sheets/passengers-edit-sheet"
import { PricingEditSheet } from "@/components/bookings/edit-sheets/pricing-edit-sheet"
import { PaymentFormDialog } from "@/components/bookings/payment-form-dialog"
import { ClientCard } from "@/components/bookings/sections/client-card"
import { HeaderCard } from "@/components/bookings/sections/header-card"
import { HotelsRoomsCard } from "@/components/bookings/sections/hotels-rooms-card"
import { NotesCard } from "@/components/bookings/sections/notes-card"
import { PassengersCard } from "@/components/bookings/sections/passengers-card"
import { PaymentsCard } from "@/components/bookings/sections/payments-card"
import { PricingCard } from "@/components/bookings/sections/pricing-card"
import { TripCard } from "@/components/bookings/sections/trip-card"
import { useTranslation } from "react-i18next"
import { ArrowLeft } from "lucide-react"
import { Link, useParams } from "react-router"
import { toast } from "sonner"

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useBookingById } from "@/hooks/queries/use-bookings"
import { useClientById } from "@/hooks/queries/use-clients"
import { useManagers } from "@/hooks/queries/use-managers"
import { usePaymentsByBooking } from "@/hooks/queries/use-payments"
import { useTripById } from "@/hooks/queries/use-trips"
import { useUpdateBookingStatus } from "@/hooks/mutations/use-update-booking-status"
import { useHotels } from "@/hooks/queries/use-hotels"
import {
  DESTRUCTIVE_STATUSES,
  TRANSITIONS,
  type BookingStatus,
} from "@/lib/booking-status"
import type { Locale } from "@/types"

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

  // Payment dialog state.
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)

  // Frictionless edit sheets (T9).
  const [notesEditOpen, setNotesEditOpen] = useState(false)
  const [contactEditOpen, setContactEditOpen] = useState(false)

  // Sensitive edit sheets (T10).
  const [passengersEditOpen, setPassengersEditOpen] = useState(false)
  const [hotelsRoomsEditOpen, setHotelsRoomsEditOpen] = useState(false)
  const [pricingEditOpen, setPricingEditOpen] = useState(false)

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

  const transitions = TRANSITIONS[booking.status] ?? []
  const manager = managerById.get(booking.managerId)

  // Resolve dialog copy based on which destructive status is pending.
  const dialogKey = pendingStatus === "no_show" ? "noShowDialog" : "cancelDialog"

  return (
    <div className="space-y-6">
      {/* Back navigation — stays outside the Tabs so it's visible from both. */}
      <Button variant="ghost" size="sm" className="self-start" render={<Link to="/" />}>
        <ArrowLeft className="size-4" />
        {t("detail.back")}
      </Button>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">{t("detail.tabs.overview")}</TabsTrigger>
          <TabsTrigger value="history">{t("detail.tabs.history")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <HeaderCard
            booking={booking}
            client={client}
            trip={trip}
            t={t}
            tc={tc}
            locale={locale}
          />

          {/* Status transitions — action surface, not a section. Stays inline. */}
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

          <ClientCard
            client={client}
            t={t}
            onEdit={() => setContactEditOpen(true)}
          />
          <TripCard trip={trip} manager={manager} t={t} locale={locale} />
          <PassengersCard
            booking={booking}
            hotels={hotels}
            t={t}
            tc={tc}
            locale={locale}
            onEdit={() => setPassengersEditOpen(true)}
          />
          <HotelsRoomsCard
            booking={booking}
            hotels={hotels}
            t={t}
            tc={tc}
            onEdit={() => setHotelsRoomsEditOpen(true)}
          />
          <PricingCard
            booking={booking}
            t={t}
            locale={locale}
            onEdit={() => setPricingEditOpen(true)}
          />
          <NotesCard
            booking={booking}
            t={t}
            onEdit={() => setNotesEditOpen(true)}
          />
          <PaymentsCard
            payments={payments}
            managerById={managerById}
            onRecordPayment={() => setPaymentDialogOpen(true)}
            t={t}
            locale={locale}
          />
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>{t("detail.tabs.history")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t("detail.history.placeholder")}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment form dialog */}
      <PaymentFormDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        bookingId={booking.id}
        bookingTotal={booking.totalPrice}
        bookingPaidAmount={booking.paidAmount}
      />

      {/* Notes edit sheet (frictionless, no reason) */}
      <NotesEditSheet
        open={notesEditOpen}
        onOpenChange={setNotesEditOpen}
        booking={booking}
      />

      {/* Contact edit sheet (frictionless, no reason) — only when client loaded */}
      {client && (
        <ContactEditSheet
          open={contactEditOpen}
          onOpenChange={setContactEditOpen}
          client={client}
        />
      )}

      {/* Sensitive edit sheets (T10) — passengers, hotels & rooms, pricing */}
      <PassengersEditSheet
        open={passengersEditOpen}
        onOpenChange={setPassengersEditOpen}
        booking={booking}
        hotels={hotels}
      />
      <HotelsRoomsEditSheet
        open={hotelsRoomsEditOpen}
        onOpenChange={setHotelsRoomsEditOpen}
        booking={booking}
        hotels={hotels}
      />
      <PricingEditSheet
        open={pricingEditOpen}
        onOpenChange={setPricingEditOpen}
        booking={booking}
        locale={locale}
      />

      {/* Confirmation dialog for destructive transitions — stays outside Tabs */}
      <Dialog
        open={pendingStatus !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStatus(null)
        }}
        disablePointerDismissal
      >
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
              onClick={() => {
                if (pendingStatus) applyTransition(pendingStatus)
              }}
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
