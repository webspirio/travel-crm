import { useEffect } from "react"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Trash2 } from "lucide-react"

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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useCreateHotel } from "@/hooks/mutations/use-create-hotel"
import { useUpdateHotel } from "@/hooks/mutations/use-update-hotel"
import type { Hotel } from "@/types"
import type { Database } from "@/types/database"

type HotelRow = Database["public"]["Tables"]["hotels"]["Row"]
type RoomType = Database["public"]["Enums"]["room_type"]

const ALL_ROOM_TYPES: RoomType[] = ["single", "double", "triple", "family"]

// --- Zod schema ---

function makeSchema(t: (key: string) => string) {
  return z
    .object({
      name: z.string().min(1, { message: t("dialog.errors.name") }),
      city: z.string().min(1, { message: t("dialog.errors.city") }),
      country: z
        .string()
        .min(1, { message: t("dialog.errors.country") })
        .regex(/^[A-Za-z]{2}$/, { message: t("dialog.errors.countryFormat") }),
      stars: z
        .number({ error: t("dialog.errors.stars") })
        .int()
        .min(1, { message: t("dialog.errors.stars") })
        .max(5, { message: t("dialog.errors.stars") }),
      address: z.string().optional(),
      notes: z.string().optional(),
      isActive: z.boolean(),
      rooms: z
        .array(
          z.object({
            roomType: z.enum(["single", "double", "triple", "family"] as const, {
              error: t("dialog.errors.duplicateRoomType"),
            }),
            totalCapacity: z
              .number({ error: t("dialog.errors.totalCapacity") })
              .int()
              .min(1, { message: t("dialog.errors.totalCapacity") }),
            pricePerNight: z
              .number({ error: t("dialog.errors.pricePerNight") })
              .min(0, { message: t("dialog.errors.pricePerNight") }),
          }),
        )
        .refine(
          (rooms) => {
            const types = rooms.map((r) => r.roomType)
            return types.length === new Set(types).size
          },
          { message: t("dialog.errors.duplicateRoomType") },
        ),
    })
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>

// --- Helpers ---

function hotelRoomsToFormRooms(
  hotel: Hotel,
): Array<{ roomType: RoomType; totalCapacity: number; pricePerNight: number }> {
  const result: Array<{ roomType: RoomType; totalCapacity: number; pricePerNight: number }> = []
  for (const type of ALL_ROOM_TYPES) {
    const r = hotel.rooms[type]
    if (r.total > 0 || r.pricePerNight > 0) {
      result.push({
        roomType: type,
        totalCapacity: r.total,
        pricePerNight: r.pricePerNight,
      })
    }
  }
  return result
}

function toFormDefaults(hotel?: Hotel): FormValues {
  if (!hotel) {
    return {
      name: "",
      city: "",
      country: "",
      stars: 3,
      address: "",
      notes: "",
      isActive: true,
      rooms: [],
    }
  }
  return {
    name: hotel.name,
    city: hotel.city,
    country: hotel.countryCode,
    stars: hotel.stars,
    address: hotel.address ?? "",
    notes: hotel.notes ?? "",
    isActive: hotel.isActive,
    rooms: hotelRoomsToFormRooms(hotel),
  }
}

/** Stable serialize for rooms comparison — order-independent */
function serializeRooms(
  rooms: Array<{ roomType: RoomType; totalCapacity: number; pricePerNight: number }>,
): string {
  return JSON.stringify(
    [...rooms].sort((a, b) => a.roomType.localeCompare(b.roomType)),
  )
}

// --- Props ---

export interface HotelFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  /** Required when mode === "edit" */
  initialHotel?: Hotel
  /** Optional callback after successful save */
  onSuccess?: (row: HotelRow) => void
}

// --- Component ---

export function HotelFormDialog({
  open,
  onOpenChange,
  mode,
  initialHotel,
  onSuccess,
}: HotelFormDialogProps) {
  const { t } = useTranslation("hotels")
  const { t: tc } = useTranslation()

  const createHotel = useCreateHotel()
  const updateHotel = useUpdateHotel()

  const isPending = createHotel.isPending || updateHotel.isPending

  const form = useForm<FormValues>({
    resolver: zodResolver(makeSchema(t)),
    defaultValues: toFormDefaults(initialHotel),
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "rooms",
  })

  // Re-initialise the form when the dialog opens.
  useEffect(() => {
    if (open) {
      form.reset(toFormDefaults(mode === "edit" ? initialHotel : undefined))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Re-initialise when initialHotel changes (e.g. user navigates between hotels).
  useEffect(() => {
    if (initialHotel) {
      form.reset(toFormDefaults(initialHotel))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHotel?.id])

  // Determine which room types are still available to add
  const watchedRooms = form.watch("rooms")
  const usedRoomTypes = new Set(watchedRooms.map((r) => r.roomType))
  const availableRoomTypes = ALL_ROOM_TYPES.filter((rt) => !usedRoomTypes.has(rt))

  async function onSubmit(values: FormValues) {
    if (mode === "create") {
      createHotel.mutate(
        {
          name: values.name,
          city: values.city,
          country: values.country,
          stars: values.stars,
          address: values.address || null,
          notes: values.notes || null,
          rooms: values.rooms.map((r) => ({
            roomType: r.roomType,
            totalCapacity: r.totalCapacity,
            pricePerNight: r.pricePerNight,
          })),
        },
        {
          onSuccess: (row) => {
            toast.success(t("dialog.success.created"))
            onOpenChange(false)
            onSuccess?.(row)
          },
          onError: (err) => {
            toast.error(err.message)
          },
        },
      )
    } else {
      if (!initialHotel) return

      // Build hotel-field diff
      const patch: Parameters<typeof updateHotel.mutate>[0]["patch"] = {}

      if (values.name !== initialHotel.name) patch.name = values.name
      if (values.city !== initialHotel.city) patch.city = values.city
      if (values.country.toUpperCase() !== initialHotel.countryCode.toUpperCase())
        patch.country = values.country
      if (values.stars !== initialHotel.stars) patch.stars = values.stars
      const newAddress = values.address || null
      if (newAddress !== (initialHotel.address ?? null)) patch.address = newAddress
      const newNotes = values.notes || null
      if (newNotes !== (initialHotel.notes ?? null)) patch.notes = newNotes
      if (values.isActive !== initialHotel.isActive) patch.isActive = values.isActive

      // Check rooms diff
      const newRooms = values.rooms.map((r) => ({
        roomType: r.roomType,
        totalCapacity: r.totalCapacity,
        pricePerNight: r.pricePerNight,
      }))
      const origRooms = hotelRoomsToFormRooms(initialHotel)
      const roomsChanged = serializeRooms(newRooms) !== serializeRooms(origRooms)

      if (roomsChanged) {
        patch.rooms = newRooms
      }

      // Empty-patch guard: nothing changed — just close
      if (Object.keys(patch).length === 0) {
        onOpenChange(false)
        return
      }

      updateHotel.mutate(
        { id: initialHotel.id, patch },
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
              <Label htmlFor="hf-name">{t("dialog.fields.name")}</Label>
              <Input
                id="hf-name"
                aria-invalid={!!form.formState.errors.name}
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            {/* City */}
            <div className="space-y-1.5">
              <Label htmlFor="hf-city">{t("dialog.fields.city")}</Label>
              <Input
                id="hf-city"
                aria-invalid={!!form.formState.errors.city}
                {...form.register("city")}
              />
              {form.formState.errors.city && (
                <p className="text-xs text-destructive">{form.formState.errors.city.message}</p>
              )}
            </div>

            {/* Country code */}
            <div className="space-y-1.5">
              <Label htmlFor="hf-country">{t("dialog.fields.country")}</Label>
              <Input
                id="hf-country"
                maxLength={2}
                style={{ textTransform: "uppercase" }}
                placeholder="IT"
                aria-invalid={!!form.formState.errors.country}
                {...form.register("country", {
                  setValueAs: (v: string) => v.toUpperCase(),
                })}
              />
              <p className="text-xs text-muted-foreground">{t("dialog.fields.countryHint")}</p>
              {form.formState.errors.country && (
                <p className="text-xs text-destructive">{form.formState.errors.country.message}</p>
              )}
            </div>

            {/* Stars */}
            <div className="space-y-1.5">
              <Label>{t("dialog.fields.stars")}</Label>
              <Controller
                control={form.control}
                name="stars"
                render={({ field }) => (
                  <Select
                    value={String(field.value)}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {"★".repeat(n)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.stars && (
                <p className="text-xs text-destructive">{form.formState.errors.stars.message}</p>
              )}
            </div>

            {/* Address — full width */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="hf-address">{t("dialog.fields.address")}</Label>
              <Input
                id="hf-address"
                {...form.register("address")}
              />
            </div>

            {/* Notes — full width */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="hf-notes">{t("dialog.fields.notes")}</Label>
              <Textarea
                id="hf-notes"
                rows={2}
                className="resize-none"
                {...form.register("notes")}
              />
            </div>

            {/* isActive — edit mode only */}
            {mode === "edit" && (
              <div className="flex items-center gap-3 sm:col-span-2">
                <Controller
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <Switch
                      id="hf-isActive"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="hf-isActive">{t("dialog.fields.isActive")}</Label>
              </div>
            )}
          </div>

          {/* Room types nested editor */}
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium">{t("dialog.rooms.title")}</p>

            {fields.length > 0 && (
              <div className="space-y-2">
                {/* Header row */}
                <div className="grid grid-cols-[1fr_100px_120px_auto] items-center gap-2 px-1">
                  <span className="text-xs text-muted-foreground">
                    {t("dialog.rooms.fields.roomType")}
                  </span>
                  <span className="text-xs text-muted-foreground text-right">
                    {t("dialog.rooms.fields.totalCapacity")}
                  </span>
                  <span className="text-xs text-muted-foreground text-right">
                    {t("dialog.rooms.fields.pricePerNight")}
                  </span>
                  <span />
                </div>

                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-[1fr_100px_120px_auto] items-start gap-2"
                  >
                    {/* Room type select */}
                    <div>
                      <Controller
                        control={form.control}
                        name={`rooms.${index}.roomType`}
                        render={({ field: f }) => (
                          <Select
                            value={f.value}
                            onValueChange={(v) => f.onChange(v as RoomType)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_ROOM_TYPES.map((rt) => (
                                <SelectItem
                                  key={rt}
                                  value={rt}
                                  disabled={
                                    usedRoomTypes.has(rt) && rt !== f.value
                                  }
                                >
                                  {tc(`room.${rt}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    {/* Total capacity */}
                    <div>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        className="text-right"
                        aria-invalid={!!form.formState.errors.rooms?.[index]?.totalCapacity}
                        {...form.register(`rooms.${index}.totalCapacity`, {
                          valueAsNumber: true,
                        })}
                      />
                      {form.formState.errors.rooms?.[index]?.totalCapacity && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.rooms[index].totalCapacity?.message}
                        </p>
                      )}
                    </div>

                    {/* Price per night */}
                    <div>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        className="text-right"
                        aria-invalid={!!form.formState.errors.rooms?.[index]?.pricePerNight}
                        {...form.register(`rooms.${index}.pricePerNight`, {
                          valueAsNumber: true,
                        })}
                      />
                      {form.formState.errors.rooms?.[index]?.pricePerNight && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.rooms[index].pricePerNight?.message}
                        </p>
                      )}
                    </div>

                    {/* Remove button */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-0.5 h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(index)}
                      aria-label={t("dialog.rooms.remove")}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Duplicate room-type error from refine */}
            {form.formState.errors.rooms?.root && (
              <p className="text-xs text-destructive">
                {form.formState.errors.rooms.root.message}
              </p>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={availableRoomTypes.length === 0}
              onClick={() => {
                const nextType = availableRoomTypes[0]
                if (nextType) {
                  append({ roomType: nextType, totalCapacity: 1, pricePerNight: 0 })
                }
              }}
            >
              {t("dialog.rooms.add")}
            </Button>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {tc("actions.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
