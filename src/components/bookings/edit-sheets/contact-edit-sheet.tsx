import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useUpdateClient } from "@/hooks/mutations/use-update-client"
import type { Client } from "@/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: Client
}

/**
 * Frictionless edit surface for the booking's primary contact (clients row).
 * Wraps the existing `useUpdateClient` mutation — contact data lives on
 * `clients`, not `bookings`, so no `update_booking_with_reason` here.
 *
 * Per plan: contact edits are always allowed regardless of booking status,
 * and never require a reason.
 *
 * The inner form is keyed on `open + client.id` so React unmounts/remounts it
 * each time the sheet re-opens — that lets `useForm({ defaultValues })` re-seed
 * from props without a setState-in-effect (which the React compiler ESLint
 * rule flags as a cascading-render risk).
 *
 * Validation rules mirror `ClientFormDialog` (firstName/lastName non-empty,
 * email format, phone non-empty) so a row edited from either surface enforces
 * the same shape.
 */
export function ContactEditSheet({ open, onOpenChange, client }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
        <ContactEditForm
          key={`${client.id}:${open ? "open" : "closed"}`}
          client={client}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  )
}

// --- Zod schema (mirrors ClientFormDialog) ---

function makeSchema(t: (key: string) => string) {
  return z.object({
    firstName: z.string().min(1, { message: t("detail.edit.errors.firstName") }),
    lastName: z.string().min(1, { message: t("detail.edit.errors.lastName") }),
    email: z.string().email({ message: t("detail.edit.errors.email") }),
    phone: z.string().min(1, { message: t("detail.edit.errors.phone") }),
  })
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>

function ContactEditForm({
  client,
  onClose,
}: {
  client: Client
  onClose: () => void
}) {
  const { t } = useTranslation("booking")
  const updateClient = useUpdateClient()

  const form = useForm<FormValues>({
    resolver: zodResolver(makeSchema(t)),
    defaultValues: {
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
    },
  })

  const isPending = updateClient.isPending || form.formState.isSubmitting

  function onSubmit(values: FormValues) {
    // Build a diff — only send fields that actually changed. Mirrors the
    // pattern used by ClientFormDialog edit mode.
    const patch: Parameters<typeof updateClient.mutate>[0]["patch"] = {}
    if (values.firstName !== client.firstName) patch.firstName = values.firstName
    if (values.lastName !== client.lastName) patch.lastName = values.lastName
    if (values.email !== client.email) patch.email = values.email
    if (values.phone !== client.phone) patch.phone = values.phone

    if (Object.keys(patch).length === 0) {
      onClose()
      return
    }

    updateClient.mutate(
      { id: client.id, patch },
      {
        onSuccess: () => {
          toast.success(t("detail.toast.contactUpdated"))
          onClose()
        },
        onError: (err) => {
          toast.error(err.message || t("detail.toast.updateFailed"))
        },
      },
    )
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="contents"
    >
      <SheetHeader>
        <SheetTitle>{t("detail.edit.contactTitle")}</SheetTitle>
        <SheetDescription>{t("detail.edit.contactDescription")}</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-3 px-4">
        <div className="space-y-1.5">
          <Label htmlFor="ce-first-name">{t("detail.edit.contactFirstName")}</Label>
          <Input
            id="ce-first-name"
            aria-invalid={!!form.formState.errors.firstName}
            disabled={isPending}
            {...form.register("firstName")}
          />
          {form.formState.errors.firstName && (
            <p className="text-xs text-destructive">
              {form.formState.errors.firstName.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ce-last-name">{t("detail.edit.contactLastName")}</Label>
          <Input
            id="ce-last-name"
            aria-invalid={!!form.formState.errors.lastName}
            disabled={isPending}
            {...form.register("lastName")}
          />
          {form.formState.errors.lastName && (
            <p className="text-xs text-destructive">
              {form.formState.errors.lastName.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ce-email">{t("detail.edit.contactEmail")}</Label>
          <Input
            id="ce-email"
            type="email"
            aria-invalid={!!form.formState.errors.email}
            disabled={isPending}
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ce-phone">{t("detail.edit.contactPhone")}</Label>
          <Input
            id="ce-phone"
            type="tel"
            aria-invalid={!!form.formState.errors.phone}
            disabled={isPending}
            {...form.register("phone")}
          />
          {form.formState.errors.phone && (
            <p className="text-xs text-destructive">
              {form.formState.errors.phone.message}
            </p>
          )}
        </div>
      </div>

      <SheetFooter className="flex flex-row justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          {t("detail.edit.cancel")}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isPending ? t("detail.edit.saving") : t("detail.edit.save")}
        </Button>
      </SheetFooter>
    </form>
  )
}
