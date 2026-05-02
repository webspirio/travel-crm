import { useTranslation } from "react-i18next"
import { AlertTriangle, Loader2, Mail, Phone, RotateCcw, User } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { ClientMatch } from "@/hooks/queries/use-client-matches"
import { cn } from "@/lib/utils"

export interface ClientMatchPanelProps {
  matches: ClientMatch[]
  isLoading: boolean
  /** Called when the user picks an existing client. Locks the form to that id. */
  onUseExisting: (clientId: string) => void
  /** Called when the user clicks "Keep new" — sets matchIgnored on the primary. */
  onIgnore: () => void
  /**
   * Called for soft-deleted email matches when an owner clicks "Restore & use".
   * The parent runs useRestoreClient and on success calls onUseExisting.
   */
  onRestore: (clientId: string) => void
  /** True while a restore is in flight (disables the Restore button). */
  isRestoring?: boolean
  className?: string
}

function initials(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?"
}

function formatDeletedDate(iso: string | null): string {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return ""
  }
}

/**
 * Shows live duplicate-detection results for the primary contact.
 *
 * Behaviour by match kind:
 *   • email match (live, score 100) → amber panel; "Use this client" + "Keep new".
 *   • email match on a soft-deleted row → orange panel; owners can restore.
 *   • phone match → softer informational panel; chips are click-to-link.
 *   • name match → collapsed banner that expands into a popover with chips.
 *
 * The parent owns ignore/clientId state on the primary passenger; this
 * component only emits intent via the callback props.
 */
export function ClientMatchPanel({
  matches,
  isLoading,
  onUseExisting,
  onIgnore,
  onRestore,
  isRestoring = false,
  className,
}: ClientMatchPanelProps) {
  const { t } = useTranslation("booking")

  if (isLoading && matches.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        <span>…</span>
      </div>
    )
  }

  if (matches.length === 0) return null

  // Partition matches by kind / soft-delete state.
  const liveEmail = matches.filter(
    (m) => m.matchKind === "email" && !m.deletedAt,
  )
  const softDeletedEmail = matches.filter(
    (m) => m.matchKind === "email" && m.deletedAt,
  )
  const phone = matches.filter((m) => m.matchKind === "phone")
  const name = matches.filter((m) => m.matchKind === "name")

  return (
    <div className={cn("space-y-2", className)}>
      {liveEmail.length > 0 && (
        <EmailMatchSection
          variant="live"
          matches={liveEmail}
          onUseExisting={onUseExisting}
          onIgnore={onIgnore}
          title={t("match.emailFound")}
        />
      )}

      {softDeletedEmail.length > 0 && (
        <SoftDeletedSection
          matches={softDeletedEmail}
          isRestoring={isRestoring}
          onRestore={onRestore}
        />
      )}

      {phone.length > 0 && (
        <PhoneMatchSection matches={phone} onUseExisting={onUseExisting} />
      )}

      {name.length > 0 && (
        <NameMatchSection matches={name} onUseExisting={onUseExisting} />
      )}
    </div>
  )
}

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function EmailMatchSection({
  variant,
  matches,
  onUseExisting,
  onIgnore,
  title,
}: {
  variant: "live"
  matches: ClientMatch[]
  onUseExisting: (clientId: string) => void
  onIgnore: () => void
  title: string
}) {
  const { t } = useTranslation("booking")
  const tone =
    variant === "live"
      ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
      : "border-orange-500 bg-orange-50 dark:bg-orange-950/30"

  return (
    <div
      role="alert"
      className={cn("rounded-md border-l-4 p-3 text-sm", tone)}
    >
      <div className="mb-2 flex items-center gap-2 font-medium text-amber-900 dark:text-amber-100">
        <AlertTriangle className="size-4" aria-hidden="true" />
        <span>{title}</span>
      </div>
      <ul className="space-y-1.5">
        {matches.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-2 rounded bg-background/60 p-2"
          >
            <Avatar size="sm">
              <AvatarFallback>{initials(m.firstName, m.lastName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium">
                {m.firstName} {m.lastName}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                {m.email && (
                  <span className="inline-flex items-center gap-1 truncate">
                    <Mail className="size-3" aria-hidden="true" />
                    {m.email}
                  </span>
                )}
                {m.phone && (
                  <span className="inline-flex items-center gap-1 truncate">
                    <Phone className="size-3" aria-hidden="true" />
                    {m.phone}
                  </span>
                )}
              </div>
            </div>
            <Button
              size="sm"
              type="button"
              onClick={() => onUseExisting(m.id)}
            >
              {t("match.useThis")}
            </Button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-amber-900/80 dark:text-amber-100/80">
        {t("match.softBlocked")}
      </p>
      <div className="mt-2 flex justify-end">
        <Button size="sm" variant="ghost" type="button" onClick={onIgnore}>
          {t("match.keepNew")}
        </Button>
      </div>
    </div>
  )
}

function SoftDeletedSection({
  matches,
  isRestoring,
  onRestore,
}: {
  matches: ClientMatch[]
  isRestoring: boolean
  onRestore: (clientId: string) => void
}) {
  const { t } = useTranslation("booking")
  return (
    <div
      role="alert"
      className="rounded-md border-l-4 border-orange-500 bg-orange-50 p-3 text-sm dark:bg-orange-950/30"
    >
      <div className="mb-2 flex items-center gap-2 font-medium text-orange-900 dark:text-orange-100">
        <RotateCcw className="size-4" aria-hidden="true" />
        <span>{t("match.softDeletedFound")}</span>
      </div>
      <ul className="space-y-1.5">
        {matches.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-2 rounded bg-background/60 p-2"
          >
            <Avatar size="sm">
              <AvatarFallback>{initials(m.firstName, m.lastName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium">
                {m.firstName} {m.lastName}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("match.deletedOn", { date: formatDeletedDate(m.deletedAt) })}
              </div>
            </div>
            <Button
              size="sm"
              type="button"
              disabled={isRestoring}
              onClick={() => onRestore(m.id)}
            >
              {isRestoring && <Loader2 className="size-3.5 animate-spin" />}
              {t("match.restore")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PhoneMatchSection({
  matches,
  onUseExisting,
}: {
  matches: ClientMatch[]
  onUseExisting: (clientId: string) => void
}) {
  const { t } = useTranslation("booking")
  return (
    <div className="rounded-md border-l-4 border-sky-400 bg-sky-50 p-3 text-sm dark:bg-sky-950/30">
      <div className="mb-1 flex items-center gap-2 font-medium text-sky-900 dark:text-sky-100">
        <Phone className="size-4" aria-hidden="true" />
        <span>{t("match.phoneMatch")}</span>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        {t("match.phoneMatchHint")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {matches.map((m) => (
          <Button
            key={m.id}
            size="sm"
            variant="outline"
            type="button"
            onClick={() => onUseExisting(m.id)}
            className="h-auto px-2 py-1 text-xs"
          >
            <User className="size-3" aria-hidden="true" />
            {m.firstName} {m.lastName}
          </Button>
        ))}
      </div>
    </div>
  )
}

function NameMatchSection({
  matches,
  onUseExisting,
}: {
  matches: ClientMatch[]
  onUseExisting: (clientId: string) => void
}) {
  const { t } = useTranslation("booking")
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-xs">
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-left text-muted-foreground hover:text-foreground"
            />
          }
        >
          <User className="size-3.5" aria-hidden="true" />
          <span>{t("match.nameMatchOpen")}</span>
          <Badge variant="outline" className="ml-1 h-4 px-1.5 text-[10px]">
            {matches.length}
          </Badge>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2">
          <ul className="space-y-1">
            {matches.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onUseExisting(m.id)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent"
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
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  )
}
