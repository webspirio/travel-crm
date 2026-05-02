import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
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
 * each time the sheet re-opens — that lets `useState(initial)` re-seed from
 * props without a setState-in-effect (which the React compiler ESLint rule
 * flags as a cascading-render risk).
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

function ContactEditForm({
  client,
  onClose,
}: {
  client: Client
  onClose: () => void
}) {
  const { t } = useTranslation("booking")
  const updateClient = useUpdateClient()

  const [firstName, setFirstName] = useState(client.firstName)
  const [lastName, setLastName] = useState(client.lastName)
  const [email, setEmail] = useState(client.email)
  const [phone, setPhone] = useState(client.phone)

  function handleSave() {
    // Build a diff — only send fields that actually changed. Mirrors the
    // pattern used by ClientFormDialog edit mode.
    const patch: Parameters<typeof updateClient.mutate>[0]["patch"] = {}
    if (firstName !== client.firstName) patch.firstName = firstName
    if (lastName !== client.lastName) patch.lastName = lastName
    if (email !== client.email) patch.email = email
    if (phone !== client.phone) patch.phone = phone

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
    <>
      <SheetHeader>
        <SheetTitle>{t("detail.edit.contactTitle")}</SheetTitle>
        <SheetDescription>{t("detail.edit.contactDescription")}</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-3 px-4">
        <div className="space-y-1.5">
          <Label htmlFor="ce-first-name">{t("detail.edit.contactFirstName")}</Label>
          <Input
            id="ce-first-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={updateClient.isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ce-last-name">{t("detail.edit.contactLastName")}</Label>
          <Input
            id="ce-last-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={updateClient.isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ce-email">{t("detail.edit.contactEmail")}</Label>
          <Input
            id="ce-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={updateClient.isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ce-phone">{t("detail.edit.contactPhone")}</Label>
          <Input
            id="ce-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={updateClient.isPending}
          />
        </div>
      </div>

      <SheetFooter className="flex flex-row justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={updateClient.isPending}
        >
          {t("detail.edit.cancel")}
        </Button>
        <Button type="button" onClick={handleSave} disabled={updateClient.isPending}>
          {updateClient.isPending && <Loader2 className="size-4 animate-spin" />}
          {updateClient.isPending ? t("detail.edit.saving") : t("detail.edit.save")}
        </Button>
      </SheetFooter>
    </>
  )
}
