import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { CalendarIcon } from "lucide-react"
import { formatDate } from "@/lib/format"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCreateClient } from "@/hooks/mutations/use-create-client"
import { useUpdateClient } from "@/hooks/mutations/use-update-client"
import type { Client, Locale } from "@/types"
import type { Database } from "@/types/database"
import { cn } from "@/lib/utils"

type ClientRow = Database["public"]["Tables"]["clients"]["Row"]

export interface ClientFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  /** Required when mode === "edit" */
  initialClient?: Client
  /** Optional callback after successful save */
  onSuccess?: (client: ClientRow) => void
}

// --- Zod schema ---

function makeSchema(t: (key: string) => string) {
  return z.object({
    firstName: z.string().min(1, { message: t("dialog.errors.firstName") }),
    lastName: z.string().min(1, { message: t("dialog.errors.lastName") }),
    email: z.string().email({ message: t("dialog.errors.email") }),
    phone: z.string().min(1, { message: t("dialog.errors.phone") }),
    nationality: z.enum(["UA", "DE"]),
    birthDate: z.date().optional(),
  })
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>

// --- Helpers ---

function toFormDefaults(client?: Client): FormValues {
  if (!client) {
    return {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      nationality: "UA",
      birthDate: undefined,
    }
  }
  // birth_date coerced to new Date(0) when null by the adapter — treat that
  // as "no date set" so edit mode doesn't pre-fill with 1970-01-01.
  const hasBirthDate =
    client.birthDate.getTime() !== 0 && !isNaN(client.birthDate.getTime())
  return {
    firstName: client.firstName,
    lastName: client.lastName,
    email: client.email,
    phone: client.phone,
    nationality: client.nationality,
    birthDate: hasBirthDate ? client.birthDate : undefined,
  }
}

// --- Component ---

export function ClientFormDialog({
  open,
  onOpenChange,
  mode,
  initialClient,
  onSuccess,
}: ClientFormDialogProps) {
  const { t, i18n } = useTranslation("clients")
  const { t: tc } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale

  const createClient = useCreateClient()
  const updateClient = useUpdateClient()

  const isPending = createClient.isPending || updateClient.isPending

  const form = useForm<FormValues>({
    resolver: zodResolver(makeSchema(t)),
    defaultValues: toFormDefaults(initialClient),
  })

  // Re-initialise the form when initialClient changes (e.g. user selects a
  // different client in the sheet without unmounting the dialog).
  useEffect(() => {
    form.reset(toFormDefaults(initialClient))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialClient?.id])

  // Reset form when dialog opens in create mode.
  useEffect(() => {
    if (open && mode === "create") {
      form.reset(toFormDefaults(undefined))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode])

  async function onSubmit(values: FormValues) {
    if (mode === "create") {
      createClient.mutate(
        {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone,
          nationality: values.nationality,
          birthDate: values.birthDate ?? null,
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
      if (!initialClient) return

      // Build a diff — only send fields that actually changed.
      const patch: Parameters<typeof updateClient.mutate>[0]["patch"] = {}

      if (values.firstName !== initialClient.firstName) patch.firstName = values.firstName
      if (values.lastName !== initialClient.lastName) patch.lastName = values.lastName
      if (values.email !== initialClient.email) patch.email = values.email
      if (values.phone !== initialClient.phone) patch.phone = values.phone
      if (values.nationality !== initialClient.nationality) patch.nationality = values.nationality

      // birth_date comparison: compare ISO strings to avoid reference equality
      // issues with Date objects.
      const newBdStr = values.birthDate?.toISOString().split("T")[0] ?? null
      const origBdStr =
        initialClient.birthDate.getTime() !== 0 && !isNaN(initialClient.birthDate.getTime())
          ? initialClient.birthDate.toISOString().split("T")[0]
          : null
      if (newBdStr !== origBdStr) {
        patch.birthDate = values.birthDate ?? null
      }

      if (Object.keys(patch).length === 0) {
        onOpenChange(false)
        return
      }

      updateClient.mutate(
        { id: initialClient.id, patch },
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

  const title =
    mode === "create" ? t("dialog.create.title") : t("dialog.edit.title")
  const submitLabel =
    mode === "create" ? t("dialog.create.submit") : t("dialog.edit.submit")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2">
            {/* First name */}
            <div className="space-y-1.5">
              <Label htmlFor="cf-firstName">{t("dialog.fields.firstName")}</Label>
              <Input
                id="cf-firstName"
                aria-invalid={!!form.formState.errors.firstName}
                {...form.register("firstName")}
              />
              {form.formState.errors.firstName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.firstName.message}
                </p>
              )}
            </div>

            {/* Last name */}
            <div className="space-y-1.5">
              <Label htmlFor="cf-lastName">{t("dialog.fields.lastName")}</Label>
              <Input
                id="cf-lastName"
                aria-invalid={!!form.formState.errors.lastName}
                {...form.register("lastName")}
              />
              {form.formState.errors.lastName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.lastName.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="cf-email">{t("dialog.fields.email")}</Label>
              <Input
                id="cf-email"
                type="email"
                aria-invalid={!!form.formState.errors.email}
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="cf-phone">{t("dialog.fields.phone")}</Label>
              <Input
                id="cf-phone"
                type="tel"
                aria-invalid={!!form.formState.errors.phone}
                {...form.register("phone")}
              />
              {form.formState.errors.phone && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.phone.message}
                </p>
              )}
            </div>

            {/* Nationality */}
            <div className="space-y-1.5">
              <Label>{t("dialog.fields.nationality")}</Label>
              <Controller
                control={form.control}
                name="nationality"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      if (v === "UA" || v === "DE") field.onChange(v)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UA">🇺🇦 Україна</SelectItem>
                      <SelectItem value="DE">🇩🇪 Deutschland</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Birth date — calendar popover */}
            <div className="space-y-1.5">
              <Label>{t("dialog.fields.birthDate")}</Label>
              <Controller
                control={form.control}
                name="birthDate"
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground",
                          )}
                        />
                      }
                    >
                      <CalendarIcon className="mr-2 size-4" />
                      {field.value
                        ? formatDate(field.value, locale)
                        : t("dialog.fields.birthDatePlaceholder")}
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => field.onChange(date ?? undefined)}
                        captionLayout="dropdown"
                        startMonth={new Date(1930, 0)}
                        endMonth={new Date(new Date().getFullYear() - 1, 11)}
                        autoFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
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
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
