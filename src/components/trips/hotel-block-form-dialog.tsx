import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { Loader2 } from "lucide-react"
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
import { useCreateHotelBlock } from "@/hooks/mutations/use-create-hotel-block"
import { useUpdateHotelBlock } from "@/hooks/mutations/use-update-hotel-block"
import { useHotels } from "@/hooks/queries/use-hotels"
import type { HotelBlock } from "@/hooks/queries/use-hotel-blocks"
import type { Database } from "@/types/database"

type RoomType = Database["public"]["Enums"]["room_type"]

const ROOM_TYPES: RoomType[] = ["single", "double", "triple", "family"]

export interface HotelBlockFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  tripId: string
  /** Required when mode === "edit" */
  initialBlock?: HotelBlock
  onSuccess?: () => void
}

// --- Zod schema ---

function makeSchema(t: (key: string) => string) {
  return z.object({
    hotelId: z.string().min(1, { message: t("blocks.dialog.errors.hotel") }),
    roomType: z.enum(["single", "double", "triple", "family"] as [RoomType, ...RoomType[]], {
      error: t("blocks.dialog.errors.roomType"),
    }),
    qtyTotal: z
      .number({ error: t("blocks.dialog.errors.qtyTotal") })
      .int({ message: t("blocks.dialog.errors.qtyTotal") })
      .min(1, { message: t("blocks.dialog.errors.qtyTotal") }),
    notes: z.string().optional(),
  })
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>

// --- Helpers ---

function toFormDefaults(block?: HotelBlock): FormValues {
  if (!block) {
    return {
      hotelId: "",
      roomType: "double",
      qtyTotal: 1,
      notes: "",
    }
  }
  return {
    hotelId: block.hotel_id,
    roomType: block.room_type,
    qtyTotal: block.qty_total,
    notes: block.notes ?? "",
  }
}

// --- Component ---

export function HotelBlockFormDialog({
  open,
  onOpenChange,
  mode,
  tripId,
  initialBlock,
  onSuccess,
}: HotelBlockFormDialogProps) {
  const { t } = useTranslation("trips")
  const { t: tc } = useTranslation()

  const createBlock = useCreateHotelBlock()
  const updateBlock = useUpdateHotelBlock()
  const { data: hotels = [], isLoading: hotelsLoading } = useHotels()

  const isPending = createBlock.isPending || updateBlock.isPending

  const form = useForm<FormValues>({
    resolver: zodResolver(makeSchema(t)),
    defaultValues: toFormDefaults(initialBlock),
  })

  // Re-initialise when the dialog opens / initialBlock changes.
  useEffect(() => {
    if (open) {
      form.reset(toFormDefaults(mode === "edit" ? initialBlock : undefined))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialBlock?.id, mode])

  async function onSubmit(values: FormValues) {
    if (mode === "create") {
      createBlock.mutate(
        {
          tripId,
          hotelId: values.hotelId,
          roomType: values.roomType,
          qtyTotal: values.qtyTotal,
          notes: values.notes || null,
        },
        {
          onSuccess: () => {
            toast.success(t("blocks.dialog.success.created"))
            onOpenChange(false)
            onSuccess?.()
          },
          onError: (err) => {
            toast.error(err.message)
          },
        },
      )
    } else {
      if (!initialBlock) return

      // Build diff — only qtyTotal and notes can change.
      const patch: Parameters<typeof updateBlock.mutate>[0]["patch"] = {}

      if (values.qtyTotal !== initialBlock.qty_total) patch.qtyTotal = values.qtyTotal

      const notesVal = values.notes || null
      if (notesVal !== (initialBlock.notes ?? null)) patch.notes = notesVal

      // Empty-patch guard.
      if (Object.keys(patch).length === 0) {
        onOpenChange(false)
        return
      }

      updateBlock.mutate(
        { id: initialBlock.id, tripId, patch },
        {
          onSuccess: () => {
            toast.success(t("blocks.dialog.success.updated"))
            onOpenChange(false)
            onSuccess?.()
          },
          onError: (err) => {
            toast.error(err.message)
          },
        },
      )
    }
  }

  const title = mode === "create" ? t("blocks.dialog.create.title") : t("blocks.dialog.edit.title")
  const submitLabel =
    mode === "create" ? t("blocks.dialog.create.submit") : t("blocks.dialog.edit.submit")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2">
            {/* Hotel — disabled in edit mode (composite PK) */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("blocks.dialog.fields.hotel")}</Label>
              <Controller
                control={form.control}
                name="hotelId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v)}
                    disabled={mode === "edit" || hotelsLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("blocks.dialog.fields.hotelPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {hotels.map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.name} — {h.city}, {h.countryCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.hotelId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.hotelId.message}
                </p>
              )}
            </div>

            {/* Room type — disabled in edit mode (composite PK) */}
            <div className="space-y-1.5">
              <Label>{t("blocks.dialog.fields.roomType")}</Label>
              <Controller
                control={form.control}
                name="roomType"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v as RoomType)}
                    disabled={mode === "edit"}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROOM_TYPES.map((rt) => (
                        <SelectItem key={rt} value={rt}>
                          {tc(`room.${rt}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.roomType && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.roomType.message}
                </p>
              )}
            </div>

            {/* Qty total */}
            <div className="space-y-1.5">
              <Label htmlFor="hb-qtyTotal">{t("blocks.dialog.fields.qtyTotal")}</Label>
              <Input
                id="hb-qtyTotal"
                type="number"
                min={1}
                step={1}
                aria-invalid={!!form.formState.errors.qtyTotal}
                {...form.register("qtyTotal", { valueAsNumber: true })}
              />
              {form.formState.errors.qtyTotal && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.qtyTotal.message}
                </p>
              )}
              {mode === "edit" && initialBlock && (
                <p className="text-xs text-muted-foreground">
                  {t("blocks.dialog.fields.qtyTotalHint", { count: initialBlock.qty_used })}
                </p>
              )}
            </div>

            {/* Used / total read-only hint — edit mode only */}
            {mode === "edit" && initialBlock && (
              <div className="space-y-1.5 sm:col-span-2">
                <p className="text-sm text-muted-foreground">
                  {t("blocks.dialog.usedHint", {
                    used: initialBlock.qty_used,
                    total: initialBlock.qty_total,
                  })}
                </p>
              </div>
            )}

            {/* Notes — full width */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="hb-notes">{t("blocks.dialog.fields.notes")}</Label>
              <Textarea
                id="hb-notes"
                rows={2}
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
