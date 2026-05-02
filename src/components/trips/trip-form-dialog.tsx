import { useEffect } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useCreateTrip } from "@/hooks/mutations/use-create-trip"
import { useUpdateTrip } from "@/hooks/mutations/use-update-trip"
import { useManagers } from "@/hooks/queries/use-managers"
import { useCurrentManager } from "@/hooks/use-current-manager"
import { useNavigate } from "react-router"
import { Loader2 } from "lucide-react"
import { ALL_TRIP_STATUSES } from "@/lib/trip-status"
import type { Trip, TripStatus } from "@/types"
import type { Database } from "@/types/database"

type TripRow = Database["public"]["Tables"]["trips"]["Row"]

// Bus seat counts implied by each bus type
const BUS_SEAT_DEFAULTS: Record<"55" | "79", number> = {
  "55": 55,
  "79": 79,
}

// Convert a Date to a string compatible with <input type="datetime-local">
// format: "YYYY-MM-DDTHH:MM"
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

// Parse a datetime-local string back to a Date (local time).
function fromDatetimeLocal(s: string): Date {
  return new Date(s)
}

export interface TripFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  /** Required when mode === "edit" */
  initialTrip?: Trip
  /** Optional callback after successful save */
  onSuccess?: (row: TripRow) => void
}

// --- Zod schema ---

function makeSchema(t: (key: string) => string) {
  return z
    .object({
      name: z.string().min(1, { message: t("dialog.errors.name") }),
      origin: z.string().min(1, { message: t("dialog.errors.origin") }),
      destination: z.string().min(1, { message: t("dialog.errors.destination") }),
      ownerManagerId: z.string().min(1, { message: t("dialog.errors.ownerManagerId") }),
      busType: z.enum(["55", "79"], { message: t("dialog.errors.busType") }),
      capacity: z
        .number({ error: t("dialog.errors.capacity") })
        .int()
        .min(1, { message: t("dialog.errors.capacity") }),
      departureAt: z.string().min(1, { message: t("dialog.errors.departureAt") }),
      returnAt: z.string().min(1, { message: t("dialog.errors.returnAt") }),
      status: z.enum(ALL_TRIP_STATUSES as [TripStatus, ...TripStatus[]]).optional(),
      basePriceEur: z
        .number({ error: t("dialog.errors.basePriceEur") })
        .finite()
        .min(0, { message: t("dialog.errors.basePriceEur") }),
      childPriceEur: z
        .number({ error: t("dialog.errors.childPriceEur") })
        .finite()
        .min(0, { message: t("dialog.errors.childPriceEur") }),
      infantPriceEur: z
        .number({ error: t("dialog.errors.infantPriceEur") })
        .finite()
        .min(0, { message: t("dialog.errors.infantPriceEur") }),
      frontRowsCount: z
        .number({ error: t("dialog.errors.frontRowsCount") })
        .int()
        .min(0, { message: t("dialog.errors.frontRowsCount") }),
      frontRowsSurchargeEur: z
        .number({ error: t("dialog.errors.frontRowsSurchargeEur") })
        .finite()
        .min(0, { message: t("dialog.errors.frontRowsSurchargeEur") }),
      notes: z.string().optional(),
    })
    .refine(
      (v) => {
        if (!v.departureAt || !v.returnAt) return true
        return fromDatetimeLocal(v.returnAt) >= fromDatetimeLocal(v.departureAt)
      },
      {
        message: t("dialog.errors.returnAfterDeparture"),
        path: ["returnAt"],
      },
    )
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>

// --- Helpers ---

function toFormDefaults(trip?: Trip, currentManagerId?: string): FormValues {
  if (!trip) {
    return {
      name: "",
      origin: "",
      destination: "",
      ownerManagerId: currentManagerId ?? "",
      busType: "55",
      capacity: BUS_SEAT_DEFAULTS["55"],
      departureAt: "",
      returnAt: "",
      status: undefined,
      basePriceEur: 0,
      childPriceEur: 0,
      infantPriceEur: 0,
      frontRowsCount: 0,
      frontRowsSurchargeEur: 0,
      notes: "",
    }
  }
  return {
    name: trip.name,
    origin: trip.origin,
    destination: trip.destination,
    ownerManagerId: trip.ownerManagerId,
    busType: trip.busType,
    capacity: trip.capacity,
    departureAt: toDatetimeLocal(trip.departureDate),
    returnAt: toDatetimeLocal(trip.returnDate),
    status: trip.status,
    basePriceEur: trip.basePrice,
    childPriceEur: trip.childPrice,
    infantPriceEur: trip.infantPrice,
    frontRowsCount: trip.frontRowsCount,
    frontRowsSurchargeEur: trip.frontRowsSurcharge,
    notes: trip.notes ?? "",
  }
}

// --- Component ---

export function TripFormDialog({
  open,
  onOpenChange,
  mode,
  initialTrip,
  onSuccess,
}: TripFormDialogProps) {
  const { t } = useTranslation("trips")
  const { t: tc } = useTranslation()
  const navigate = useNavigate()

  const createTrip = useCreateTrip()
  const updateTrip = useUpdateTrip()
  const managersQuery = useManagers()
  const managers = managersQuery.data ?? []
  const { data: currentManagerRow } = useCurrentManager()

  const isPending = createTrip.isPending || updateTrip.isPending

  const form = useForm<FormValues>({
    resolver: zodResolver(makeSchema(t)),
    defaultValues: toFormDefaults(initialTrip, currentManagerRow?.id),
  })

  // When the dialog opens in create mode, re-set defaults now that currentManagerRow may have loaded.
  useEffect(() => {
    if (open && mode === "create") {
      form.reset(toFormDefaults(undefined, currentManagerRow?.id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, currentManagerRow?.id])

  // Re-initialise when the initialTrip changes in edit mode.
  useEffect(() => {
    if (initialTrip) {
      form.reset(toFormDefaults(initialTrip, currentManagerRow?.id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTrip?.id])

  // When bus type changes, auto-suggest capacity unless the user has manually edited it.
  // Only fires in create mode — in edit mode the operator has authoritative
  // control over capacity and we must never silently overwrite it.
  const watchedBusType = useWatch({ control: form.control, name: "busType" })
  const capacityDirty = form.formState.dirtyFields.capacity
  useEffect(() => {
    if (mode === "create" && !capacityDirty) {
      form.setValue("capacity", BUS_SEAT_DEFAULTS[watchedBusType])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedBusType, capacityDirty, mode])

  async function onSubmit(values: FormValues) {
    const departureAt = fromDatetimeLocal(values.departureAt)
    const returnAt = fromDatetimeLocal(values.returnAt)

    if (mode === "create") {
      createTrip.mutate(
        {
          name: values.name,
          origin: values.origin,
          destination: values.destination,
          ownerManagerId: values.ownerManagerId,
          busType: values.busType,
          capacity: values.capacity,
          departureAt,
          returnAt,
          basePriceEur: values.basePriceEur,
          childPriceEur: values.childPriceEur,
          infantPriceEur: values.infantPriceEur,
          frontRowsCount: values.frontRowsCount,
          frontRowsSurchargeEur: values.frontRowsSurchargeEur,
          notes: values.notes || null,
        },
        {
          onSuccess: (row) => {
            toast.success(t("dialog.success.createdNudge"))
            onOpenChange(false)
            onSuccess?.(row)
            void navigate(`/trips/${row.id}`)
          },
          onError: (err) => {
            toast.error(err.message)
          },
        },
      )
    } else {
      if (!initialTrip) return

      // Build a diff — only send fields that actually changed.
      const patch: Parameters<typeof updateTrip.mutate>[0]["patch"] = {}

      if (values.name !== initialTrip.name) patch.name = values.name
      if (values.origin !== initialTrip.origin) patch.origin = values.origin
      if (values.destination !== initialTrip.destination) patch.destination = values.destination
      if (values.ownerManagerId !== initialTrip.ownerManagerId)
        patch.ownerManagerId = values.ownerManagerId
      if (values.busType !== initialTrip.busType)
        patch.busType = values.busType
      if (values.capacity !== initialTrip.capacity) patch.capacity = values.capacity
      if (departureAt.toISOString() !== initialTrip.departureDate.toISOString())
        patch.departureAt = departureAt
      if (returnAt.toISOString() !== initialTrip.returnDate.toISOString())
        patch.returnAt = returnAt
      if (values.basePriceEur !== initialTrip.basePrice) patch.basePriceEur = values.basePriceEur
      if (values.childPriceEur !== initialTrip.childPrice)
        patch.childPriceEur = values.childPriceEur
      if (values.infantPriceEur !== initialTrip.infantPrice)
        patch.infantPriceEur = values.infantPriceEur
      if (values.frontRowsCount !== initialTrip.frontRowsCount)
        patch.frontRowsCount = values.frontRowsCount
      if (values.frontRowsSurchargeEur !== initialTrip.frontRowsSurcharge)
        patch.frontRowsSurchargeEur = values.frontRowsSurchargeEur
      const notesVal = values.notes || null
      if (notesVal !== initialTrip.notes) patch.notes = notesVal
      if (values.status && values.status !== initialTrip.status)
        patch.status = values.status

      // Empty-patch guard: no changes — just close.
      if (Object.keys(patch).length === 0) {
        onOpenChange(false)
        return
      }

      updateTrip.mutate(
        { id: initialTrip.id, patch },
        {
          onSuccess: (row) => {
            toast.success(t("dialog.success.updated"))
            onOpenChange(false)
            onSuccess?.(row)
          },
          onError: (err) => {
            toast.error(err.message)
          },
        },
      )
    }
  }

  const title = mode === "create" ? t("dialog.create.title") : t("dialog.edit.title")
  const submitLabel = mode === "create" ? t("dialog.create.submit") : t("dialog.edit.submit")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2">
            {/* Name — full width */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tf-name">{t("dialog.fields.name")}</Label>
              <Input
                id="tf-name"
                aria-invalid={!!form.formState.errors.name}
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            {/* Origin */}
            <div className="space-y-1.5">
              <Label htmlFor="tf-origin">{t("dialog.fields.origin")}</Label>
              <Input
                id="tf-origin"
                aria-invalid={!!form.formState.errors.origin}
                {...form.register("origin")}
              />
              {form.formState.errors.origin && (
                <p className="text-xs text-destructive">{form.formState.errors.origin.message}</p>
              )}
            </div>

            {/* Destination */}
            <div className="space-y-1.5">
              <Label htmlFor="tf-destination">{t("dialog.fields.destination")}</Label>
              <Input
                id="tf-destination"
                aria-invalid={!!form.formState.errors.destination}
                {...form.register("destination")}
              />
              {form.formState.errors.destination && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.destination.message}
                </p>
              )}
            </div>

            {/* Bus type */}
            <div className="space-y-1.5">
              <Label>{t("dialog.fields.busType")}</Label>
              <Controller
                control={form.control}
                name="busType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="55">{t("dialog.busTypes.55")}</SelectItem>
                      <SelectItem value="79">{t("dialog.busTypes.79")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.busType && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.busType.message}
                </p>
              )}
            </div>

            {/* Capacity */}
            <div className="space-y-1.5">
              <Label htmlFor="tf-capacity">{t("dialog.fields.capacity")}</Label>
              <Input
                id="tf-capacity"
                type="number"
                min={1}
                step={1}
                aria-invalid={!!form.formState.errors.capacity}
                {...form.register("capacity", { valueAsNumber: true })}
              />
              {form.formState.errors.capacity && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.capacity.message}
                </p>
              )}
            </div>

            {/* Owner manager — full width */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("dialog.fields.owner")}</Label>
              <Controller
                control={form.control}
                name="ownerManagerId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
                    <SelectTrigger className="w-full" disabled={managersQuery.isLoading}>
                      <SelectValue placeholder={t("dialog.fields.ownerPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.ownerManagerId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.ownerManagerId.message}
                </p>
              )}
            </div>

            {/* Departure at */}
            <div className="space-y-1.5">
              <Label htmlFor="tf-departureAt">{t("dialog.fields.departureAt")}</Label>
              <Input
                id="tf-departureAt"
                type="datetime-local"
                aria-invalid={!!form.formState.errors.departureAt}
                {...form.register("departureAt")}
              />
              {form.formState.errors.departureAt && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.departureAt.message}
                </p>
              )}
            </div>

            {/* Return at */}
            <div className="space-y-1.5">
              <Label htmlFor="tf-returnAt">{t("dialog.fields.returnAt")}</Label>
              <Input
                id="tf-returnAt"
                type="datetime-local"
                aria-invalid={!!form.formState.errors.returnAt}
                {...form.register("returnAt")}
              />
              {form.formState.errors.returnAt && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.returnAt.message}
                </p>
              )}
            </div>

            {/* Status — edit mode only */}
            {mode === "edit" && (
              <div className="space-y-1.5">
                <Label>{t("dialog.fields.status")}</Label>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => field.onChange(v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_TRIP_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {tc(`status.${s}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            {/* Prices */}
            <div className="space-y-1.5">
              <Label htmlFor="tf-basePrice">{t("dialog.fields.basePrice")}</Label>
              <Input
                id="tf-basePrice"
                type="number"
                min={0}
                step={0.01}
                aria-invalid={!!form.formState.errors.basePriceEur}
                {...form.register("basePriceEur", { valueAsNumber: true })}
              />
              {form.formState.errors.basePriceEur && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.basePriceEur.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tf-childPrice">{t("dialog.fields.childPrice")}</Label>
              <Input
                id="tf-childPrice"
                type="number"
                min={0}
                step={0.01}
                aria-invalid={!!form.formState.errors.childPriceEur}
                {...form.register("childPriceEur", { valueAsNumber: true })}
              />
              {form.formState.errors.childPriceEur && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.childPriceEur.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tf-infantPrice">{t("dialog.fields.infantPrice")}</Label>
              <Input
                id="tf-infantPrice"
                type="number"
                min={0}
                step={0.01}
                aria-invalid={!!form.formState.errors.infantPriceEur}
                {...form.register("infantPriceEur", { valueAsNumber: true })}
              />
              {form.formState.errors.infantPriceEur && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.infantPriceEur.message}
                </p>
              )}
            </div>

            {/* Front rows */}
            <div className="space-y-1.5">
              <Label htmlFor="tf-frontRowsCount">{t("dialog.fields.frontRowsCount")}</Label>
              <Input
                id="tf-frontRowsCount"
                type="number"
                min={0}
                step={1}
                aria-invalid={!!form.formState.errors.frontRowsCount}
                {...form.register("frontRowsCount", { valueAsNumber: true })}
              />
              {form.formState.errors.frontRowsCount && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.frontRowsCount.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tf-frontRowsSurcharge">
                {t("dialog.fields.frontRowsSurcharge")}
              </Label>
              <Input
                id="tf-frontRowsSurcharge"
                type="number"
                min={0}
                step={0.01}
                aria-invalid={!!form.formState.errors.frontRowsSurchargeEur}
                {...form.register("frontRowsSurchargeEur", { valueAsNumber: true })}
              />
              {form.formState.errors.frontRowsSurchargeEur && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.frontRowsSurchargeEur.message}
                </p>
              )}
            </div>

            {/* Notes — full width */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tf-notes">{t("dialog.fields.notes")}</Label>
              <Textarea
                id="tf-notes"
                rows={3}
                className="resize-none"
                {...form.register("notes")}
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {tc("actions.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
