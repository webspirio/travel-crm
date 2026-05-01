import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, ChevronUp, Save, Star, User, X } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
import { ClientMatchPanel } from "@/components/booking-form/client-match-panel"
import type { ClientMatch } from "@/hooks/queries/use-client-matches"
import {
  defaultPriceFor,
  inferKindFromBirthDate,
} from "@/lib/passenger-pricing"
import { defaultCountryFor, toE164 } from "@/lib/phone"
import { cn } from "@/lib/utils"
import type { PassengerDraft } from "@/stores/booking-store"
import type { PassengerKind, Trip } from "@/types"

export interface TravelerCardProps {
  passenger: PassengerDraft
  trip: Trip | null
  /** Match list — primary only; null for extras. */
  matches: ClientMatch[] | null
  isMatchesLoading: boolean
  isOwner: boolean
  expanded: boolean
  onToggleExpand: () => void
  onUpdate: (patch: Partial<PassengerDraft>) => void
  /** Primary-only: pick an existing client and lock the form. */
  onUseExisting?: (clientId: string) => void
  /** Primary-only: ignore the match and proceed with a new client. */
  onIgnoreMatch?: () => void
  /** Primary-only: restore a soft-deleted client (owner-gated). */
  onRestoreMatch?: (clientId: string) => void
  /** Primary-only: true while a restore mutation is in flight. */
  isRestoring?: boolean
  /** Extras-only: open the inline Save-as-client form. */
  onPromote?: () => void
  /** Extras-only: promote this passenger to primary. */
  onMakePrimary?: () => void
  /** Extras-only: remove this passenger from the draft. */
  onRemove?: () => void
}

function initials(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?"
}

const KIND_OPTIONS: PassengerKind[] = ["adult", "child", "infant"]

/**
 * Single passenger row in the Travelers step.
 *
 * Always-visible header: avatar, name, kind badge, price, primary star,
 * and (extras only) inline action buttons. The body is collapsible; the
 * parent owns the open/closed state so a click on a card can pop another
 * one closed if desired.
 *
 * Birth-date → kind auto-inference: only flips kind when the field is
 * still at the trip's default for the current kind. Once the manager
 * has overridden either kind or price (via `priceOverridden`) we leave
 * them alone.
 */
export function TravelerCard({
  passenger,
  trip,
  matches,
  isMatchesLoading,
  isOwner,
  expanded,
  onToggleExpand,
  onUpdate,
  onUseExisting,
  onIgnoreMatch,
  onRestoreMatch,
  isRestoring = false,
  onPromote,
  onMakePrimary,
  onRemove,
}: TravelerCardProps) {
  const { t } = useTranslation("booking")
  const firstNameRef = useRef<HTMLInputElement | null>(null)

  // Auto-focus first name when an extra passenger is freshly added (firstName
  // empty + expanded). Primary autofocuses naturally on mount.
  useEffect(() => {
    if (expanded && !passenger.firstName && firstNameRef.current) {
      firstNameRef.current.focus()
    }
    // Only trigger on expand transition / fresh mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded])

  const onBirthDateBlur = (value: string) => {
    const inferred = inferKindFromBirthDate(value || null)
    // Only flip kind when the price hasn't been overridden — otherwise the
    // manager has explicitly set both fields and we shouldn't second-guess.
    if (!passenger.priceOverridden && inferred !== passenger.kind) {
      onUpdate({
        kind: inferred,
        priceEur: defaultPriceFor(trip, inferred),
      })
    }
  }

  const onKindChange = (next: PassengerKind) => {
    onUpdate({
      kind: next,
      priceEur: passenger.priceOverridden
        ? passenger.priceEur
        : defaultPriceFor(trip, next),
    })
  }

  const onPriceChange = (raw: string) => {
    const num = Number(raw)
    if (Number.isNaN(num)) return
    onUpdate({ priceEur: num, priceOverridden: true })
  }

  const onPhoneChange = (raw: string | undefined) => {
    const value = raw ?? ""
    const e164 = value
      ? toE164(value, defaultCountryFor(passenger.nationality))
      : null
    onUpdate({ phoneRaw: value, phoneE164: e164 })
  }

  const isLapInfant = passenger.kind === "infant" && passenger.seatNumber == null
  const displayName =
    passenger.firstName || passenger.lastName
      ? `${passenger.firstName} ${passenger.lastName}`.trim()
      : t("travelers.namePlaceholder")

  return (
    <div
      className={cn(
        "rounded-lg border bg-card transition-colors",
        passenger.isPrimary && "ring-1 ring-primary/30",
      )}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex flex-1 items-center gap-3 text-left"
          aria-expanded={expanded}
        >
          <Avatar size="sm">
            <AvatarFallback>
              {initials(passenger.firstName, passenger.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
            <span
              className={cn(
                "truncate font-medium",
                !passenger.firstName &&
                  !passenger.lastName &&
                  "text-muted-foreground italic",
              )}
            >
              {displayName}
            </span>
            <KindBadge kind={passenger.kind} />
            {isLapInfant && (
              <span className="text-xs text-muted-foreground">
                ({t("travelers.lapInfant")})
              </span>
            )}
            {passenger.seatNumber != null && (
              <Badge variant="outline" className="text-xs">
                #{passenger.seatNumber}
              </Badge>
            )}
            {passenger.isPrimary && (
              <Badge className="gap-1">
                <Star className="size-3 fill-current" aria-hidden="true" />
                {t("travelers.primaryBadge")}
              </Badge>
            )}
          </div>
          <span className="ml-auto shrink-0 text-sm tabular-nums">
            € {passenger.priceEur}
          </span>
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </button>

        {!passenger.isPrimary && (
          <div className="flex shrink-0 items-center gap-1">
            {onPromote && (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={onPromote}
                title={t("travelers.savePromote")}
              >
                <Save className="size-3.5" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">
                  {t("travelers.savePromote")}
                </span>
              </Button>
            )}
            {onMakePrimary && (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={onMakePrimary}
                title={t("travelers.makePrimary")}
              >
                <Star className="size-3.5" aria-hidden="true" />
                <span className="sr-only">{t("travelers.makePrimary")}</span>
              </Button>
            )}
            {onRemove && (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={onRemove}
                title={t("travelers.remove")}
              >
                <X className="size-3.5" aria-hidden="true" />
                <span className="sr-only">{t("travelers.remove")}</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t bg-muted/20 p-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`fn-${passenger.localId}`}>
                {t("client.firstName")}
              </Label>
              <Input
                id={`fn-${passenger.localId}`}
                ref={firstNameRef}
                value={passenger.firstName}
                onChange={(e) => onUpdate({ firstName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`ln-${passenger.localId}`}>
                {t("client.lastName")}
              </Label>
              <Input
                id={`ln-${passenger.localId}`}
                value={passenger.lastName}
                onChange={(e) => onUpdate({ lastName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`dob-${passenger.localId}`}>
                {t("travelers.dobLabel")}
              </Label>
              <Input
                id={`dob-${passenger.localId}`}
                type="date"
                value={passenger.birthDate ?? ""}
                onChange={(e) =>
                  onUpdate({ birthDate: e.target.value || null })
                }
                onBlur={(e) => onBirthDateBlur(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("detail.passengers.kind")}</Label>
              <Select
                value={passenger.kind}
                onValueChange={(v) => {
                  if (
                    v === "adult" ||
                    v === "child" ||
                    v === "infant"
                  ) {
                    onKindChange(v)
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(
                        `travelers.kind${k.charAt(0).toUpperCase()}${k.slice(1)}`,
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`price-${passenger.localId}`}>
                {t("travelers.priceLabel")}
              </Label>
              <Input
                id={`price-${passenger.localId}`}
                type="number"
                inputMode="decimal"
                min={0}
                step={1}
                value={passenger.priceEur}
                onChange={(e) => onPriceChange(e.target.value)}
              />
              {!passenger.priceOverridden && trip && (
                <p className="text-xs text-muted-foreground">
                  {t("travelers.priceDefault", {
                    amount: defaultPriceFor(trip, passenger.kind),
                  })}
                </p>
              )}
            </div>
          </div>

          {/* Primary-only contact fields */}
          {passenger.isPrimary && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={`em-${passenger.localId}`}>
                  {t("client.email")}
                </Label>
                <Input
                  id={`em-${passenger.localId}`}
                  type="email"
                  value={passenger.email}
                  onChange={(e) =>
                    onUpdate({
                      email: e.target.value,
                      // Editing the email after a match was acknowledged
                      // resets the ignore flag — a new lookup is about to
                      // run on the next debounce tick.
                      matchIgnored: false,
                      clientId: null,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`ph-${passenger.localId}`}>
                  {t("client.phone")}
                </Label>
                <PhoneInput
                  id={`ph-${passenger.localId}`}
                  value={passenger.phoneRaw}
                  onChange={onPhoneChange}
                  defaultCountry={defaultCountryFor(passenger.nationality)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("client.nationality")}</Label>
                <Select
                  value={passenger.nationality ?? ""}
                  onValueChange={(v) => {
                    if (v === "UA" || v === "DE") {
                      onUpdate({ nationality: v })
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UA">🇺🇦 Україна</SelectItem>
                    <SelectItem value="DE">🇩🇪 Deutschland</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Match panel below the contact fields (primary only) */}
          {passenger.isPrimary &&
            matches !== null &&
            !passenger.clientId &&
            onUseExisting &&
            onIgnoreMatch &&
            onRestoreMatch && (
              <ClientMatchPanel
                matches={passenger.matchIgnored ? [] : matches}
                isLoading={isMatchesLoading}
                onUseExisting={onUseExisting}
                onIgnore={onIgnoreMatch}
                onRestore={onRestoreMatch}
                isRestoring={isRestoring}
                isOwner={isOwner}
              />
            )}

          {/* If primary is locked to an existing client, show a small chip */}
          {passenger.isPrimary && passenger.clientId && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-50 p-2 text-xs dark:bg-emerald-950/30">
              <User className="size-3.5 text-emerald-700 dark:text-emerald-300" />
              <span className="text-emerald-900 dark:text-emerald-100">
                {t("client.selected")}
              </span>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                className="ml-auto h-6 px-2 text-xs"
                onClick={() =>
                  onUpdate({ clientId: null, matchIgnored: false })
                }
              >
                <X className="size-3" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function KindBadge({ kind }: { kind: PassengerKind }) {
  const { t } = useTranslation("booking")
  const variant: "default" | "secondary" | "outline" =
    kind === "adult" ? "secondary" : kind === "child" ? "outline" : "outline"
  return (
    <Badge variant={variant} className="text-xs">
      {t(`travelers.kind${kind.charAt(0).toUpperCase()}${kind.slice(1)}`)}
    </Badge>
  )
}
