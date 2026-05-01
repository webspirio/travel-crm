import { useState } from "react"
import { useTranslation } from "react-i18next"
import { isValidPhoneNumber } from "libphonenumber-js"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/ui/phone-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { usePromotePassenger } from "@/hooks/mutations/use-promote-passenger"
import type { ClientMatch } from "@/hooks/queries/use-client-matches"
import { defaultCountryFor, toE164 } from "@/lib/phone"
import type { PassengerDraft } from "@/stores/booking-store"

export interface SaveAsClientFormProps {
  passenger: PassengerDraft
  onSaved: (clientId: string) => void
  onCancel: () => void
}

function initials(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?"
}

/**
 * Inline mini-form for promoting an extra passenger to a client. Used from
 * TravelerCard's "Save as client" affordance.
 *
 * First name / last name / DOB are read-only — they come from the passenger
 * row itself. The user supplies the contact fields (email, phone, nationality)
 * the find_client_matches RPC needs.
 *
 * Two-pass flow:
 *   1. Submit with forceCreate=false → if matches exist, render an inline
 *      confirm UI; user picks one OR presses "Create new instead".
 *   2. Submit with forceCreate=true → RPC inserts directly.
 */
export function SaveAsClientForm({
  passenger,
  onSaved,
  onCancel,
}: SaveAsClientFormProps) {
  const { t } = useTranslation("booking")
  const { t: tc } = useTranslation()

  const promote = usePromotePassenger()

  const [email, setEmail] = useState(passenger.email)
  const [phone, setPhone] = useState(passenger.phoneRaw)
  const [nationality, setNationality] = useState<"UA" | "DE">(
    passenger.nationality ?? "DE",
  )

  const [matches, setMatches] = useState<ClientMatch[] | null>(null)

  const phoneE164 = phone ? toE164(phone, defaultCountryFor(nationality)) : null
  const phoneIsValid = phone ? isValidPhoneNumber(phone) : true
  const emailIsValid = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const canSubmit =
    !promote.isPending &&
    phoneIsValid &&
    emailIsValid &&
    Boolean(passenger.firstName) &&
    Boolean(passenger.lastName)

  const submit = async (forceCreate: boolean) => {
    try {
      const result = await promote.mutateAsync({
        firstName: passenger.firstName,
        lastName: passenger.lastName,
        email: email || null,
        phone: phone || null,
        phoneE164,
        nationality,
        birthDate: passenger.birthDate,
        forceCreate,
      })
      if (result.matched && result.matched.length > 0) {
        setMatches(result.matched)
        return
      }
      if (result.createdClientId) {
        onSaved(result.createdClientId)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error")
    }
  }

  // ── Confirm-pane: matches were found on the first pass ────────────────────
  if (matches && matches.length > 0) {
    return (
      <div className="space-y-3 rounded-md border border-amber-500 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
        <p className="font-medium text-amber-900 dark:text-amber-100">
          {t("travelers.maybeExists")}
        </p>
        <ul className="space-y-1.5">
          {matches.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 rounded bg-background/60 p-2"
            >
              <Avatar size="sm">
                <AvatarFallback>
                  {initials(m.firstName, m.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">
                  {m.firstName} {m.lastName}
                </div>
                {m.email && (
                  <div className="truncate text-xs text-muted-foreground">
                    {m.email}
                  </div>
                )}
              </div>
              <Button size="sm" type="button" onClick={() => onSaved(m.id)}>
                {t("travelers.linkExisting")}
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={promote.isPending}
          >
            {tc("actions.cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => submit(true)}
            disabled={promote.isPending}
          >
            {promote.isPending && <Loader2 className="size-3.5 animate-spin" />}
            {t("travelers.createInstead")}
          </Button>
        </div>
      </div>
    )
  }

  // ── Edit-pane ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
      <p className="text-xs text-muted-foreground">
        {t("travelers.savePromoteHelp")}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("client.firstName")}</Label>
          <Input value={passenger.firstName} readOnly disabled />
        </div>
        <div className="space-y-1.5">
          <Label>{t("client.lastName")}</Label>
          <Input value={passenger.lastName} readOnly disabled />
        </div>
        {passenger.birthDate && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("travelers.dobLabel")}</Label>
            <Input value={passenger.birthDate} readOnly disabled />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor={`promote-email-${passenger.localId}`}>
            {t("client.email")}
          </Label>
          <Input
            id={`promote-email-${passenger.localId}`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!emailIsValid}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`promote-phone-${passenger.localId}`}>
            {t("client.phone")}
          </Label>
          <PhoneInput
            id={`promote-phone-${passenger.localId}`}
            value={phone}
            onChange={(v) => setPhone(v ?? "")}
            defaultCountry={defaultCountryFor(nationality)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{t("client.nationality")}</Label>
          <Select
            value={nationality}
            onValueChange={(v) => {
              if (v === "UA" || v === "DE") setNationality(v)
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
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={promote.isPending}
        >
          {tc("actions.cancel")}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => submit(false)}
          disabled={!canSubmit}
        >
          {promote.isPending && <Loader2 className="size-3.5 animate-spin" />}
          {t("travelers.savePromote")}
        </Button>
      </div>
    </div>
  )
}
