import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
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
import { useRecordPayment } from "@/hooks/mutations/use-record-payment"
import { formatCurrency } from "@/lib/format"
import type { Locale } from "@/types"

export interface PaymentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  /** Used only for the "Outstanding" hint; not validated against. */
  bookingTotal: number
  bookingPaidAmount: number
  onSuccess?: () => void
}

// --- Zod schema ---

function makeSchema(t: (key: string) => string) {
  return z.object({
    amount: z
      .number()
      .refine((v) => Number.isFinite(v) && v !== 0, {
        message: t("detail.payments.errors.amount"),
      }),
    method: z.enum(["cash", "bank_transfer", "card"] as const),
    receivedAt: z.string().min(1),
    reference: z.string().optional(),
    notes: z.string().optional(),
  })
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>

function todayIso(): string {
  return new Date().toISOString().split("T")[0]
}

function toDefaultValues(): FormValues {
  return {
    amount: 0,
    method: "cash",
    receivedAt: todayIso(),
    reference: "",
    notes: "",
  }
}

// --- Component ---

export function PaymentFormDialog({
  open,
  onOpenChange,
  bookingId,
  bookingTotal,
  bookingPaidAmount,
  onSuccess,
}: PaymentFormDialogProps) {
  const { t, i18n } = useTranslation("booking")
  const { t: tc } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale

  const recordPayment = useRecordPayment()

  const form = useForm<FormValues>({
    resolver: zodResolver(makeSchema(t)),
    defaultValues: toDefaultValues(),
  })

  // Reset form each time the dialog opens.
  useEffect(() => {
    if (open) {
      form.reset(toDefaultValues())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function onSubmit(values: FormValues) {
    recordPayment.mutate(
      {
        bookingId,
        amount: values.amount,
        method: values.method,
        receivedAt: new Date(values.receivedAt),
        reference: values.reference || undefined,
        notes: values.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t("detail.payments.success"))
          onOpenChange(false)
          onSuccess?.()
        },
        onError: (err) => {
          toast.error(err.message)
        },
      },
    )
  }

  const outstanding = bookingTotal - bookingPaidAmount

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("detail.payments.dialog.title")}</DialogTitle>
        </DialogHeader>

        {/* Outstanding hint */}
        <div className="rounded-md bg-muted px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t("detail.payments.dialog.outstanding", { amount: formatCurrency(outstanding, locale) })}</span>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2">
            {/* Amount */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pf-amount">{t("detail.payments.fields.amount")}</Label>
              <Input
                id="pf-amount"
                type="number"
                step="0.01"
                aria-invalid={!!form.formState.errors.amount}
                {...form.register("amount", { valueAsNumber: true })}
              />
              {form.formState.errors.amount && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.amount.message}
                </p>
              )}
            </div>

            {/* Method */}
            <div className="space-y-1.5">
              <Label>{t("detail.payments.fields.method")}</Label>
              <Controller
                control={form.control}
                name="method"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      if (v === "cash" || v === "bank_transfer" || v === "card") {
                        field.onChange(v)
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{t("detail.payments.methods.cash")}</SelectItem>
                      <SelectItem value="bank_transfer">{t("detail.payments.methods.bank_transfer")}</SelectItem>
                      <SelectItem value="card">{t("detail.payments.methods.card")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Received at */}
            <div className="space-y-1.5">
              <Label htmlFor="pf-receivedAt">{t("detail.payments.fields.receivedAt")}</Label>
              <Input
                id="pf-receivedAt"
                type="date"
                aria-invalid={!!form.formState.errors.receivedAt}
                {...form.register("receivedAt")}
              />
            </div>

            {/* Reference */}
            <div className="space-y-1.5">
              <Label htmlFor="pf-reference">{t("detail.payments.fields.reference")}</Label>
              <Input
                id="pf-reference"
                type="text"
                {...form.register("reference")}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pf-notes">{t("detail.payments.fields.notes")}</Label>
              <Textarea
                id="pf-notes"
                rows={2}
                {...form.register("notes")}
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={recordPayment.isPending}
            >
              {tc("actions.cancel")}
            </Button>
            <Button type="submit" disabled={recordPayment.isPending}>
              {t("detail.payments.dialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
