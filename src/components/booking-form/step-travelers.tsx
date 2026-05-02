import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Plus, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ClientMatchPanel } from "@/components/booking-form/client-match-panel"
import { SaveAsClientForm } from "@/components/booking-form/save-as-client-form"
import { TravelerCard } from "@/components/booking-form/traveler-card"
import { useRestoreClient } from "@/hooks/mutations/use-restore-client"
import { useClientMatches } from "@/hooks/queries/use-client-matches"
import { useTripById } from "@/hooks/queries/use-trips"
import { formatCurrency } from "@/lib/format"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import { useAuthStore } from "@/stores/auth-store"
import { useBookingDraft, useBookingDraftStore } from "@/lib/booking-draft-context"
import type { Locale, PassengerKind } from "@/types"

/**
 * Travelers step (multi-passenger). Replaces the legacy Client step.
 *
 * Reads the new BookingDraft directly from the store (NOT via the legacy
 * compatibility selector). All other current steps still use the legacy
 * shape; that's expected — Tasks 7–10 will migrate them.
 *
 * UX trade-offs (search the surrounding tasks for full context):
 *   • Live total uses formatCurrency (no decimals) consistent with the rest
 *     of the app. Hotel cost is a placeholder slot until Task 8.
 *   • Birth-date → kind inference fires on blur (not change) so a partly-
 *     typed year doesn't briefly classify someone as an infant.
 *   • Soft-blocks "Continue" when a live email match is present and the
 *     manager hasn't either picked an existing client or pressed "Keep new".
 */
export function StepTravelers({ editMode = false }: { editMode?: boolean } = {}) {
  const { t, i18n } = useTranslation("booking")
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale

  const tenantId = useAuthStore((s) => s.tenant?.id ?? null)

  const passengers = useBookingDraft((s) => s.passengers)
  const tripId = useBookingDraft((s) => s.tripId)
  const addPassenger = useBookingDraft((s) => s.addPassenger)
  const removePassenger = useBookingDraft((s) => s.removePassenger)
  const updatePassenger = useBookingDraft((s) => s.updatePassenger)
  const setPrimary = useBookingDraft((s) => s.setPrimary)
  const draftStore = useBookingDraftStore()

  const { data: trip = null } = useTripById(tripId ?? undefined)

  const primary = passengers[0]
  const extras = useMemo(() => passengers.slice(1), [passengers])

  // Debounced primary identifiers feed find_client_matches.
  const debouncedEmail = useDebouncedValue(primary?.email ?? "", 300)
  const debouncedPhoneE164 = useDebouncedValue(primary?.phoneE164 ?? null, 300)
  const debouncedFirst = useDebouncedValue(primary?.firstName ?? "", 300)
  const debouncedLast = useDebouncedValue(primary?.lastName ?? "", 300)

  const matchesQuery = useClientMatches({
    tenantId,
    email: debouncedEmail || null,
    phoneE164: debouncedPhoneE164 || null,
    firstName: debouncedFirst || null,
    lastName: debouncedLast || null,
    enabled: !primary?.clientId,
  })

  const restoreClient = useRestoreClient()

  // Track which cards are open. Primary auto-opens until the form is valid.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(primary ? [primary.localId] : []),
  )

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Track which extra is currently in promote-to-client form.
  const [promotingId, setPromotingId] = useState<string | null>(null)

  const handleAdd = (kind: PassengerKind = "adult") => {
    addPassenger(kind)
    // Open the freshly-added card. The new id isn't in state yet, but the
    // store will append it; we rely on the focus-on-mount effect inside
    // TravelerCard to handle keyboard focus.
    requestAnimationFrame(() => {
      const latest = draftStore.getState().passengers
      const newest = latest[latest.length - 1]
      if (newest) {
        setExpandedIds((prev) => new Set(prev).add(newest.localId))
      }
    })
  }

  const handleFamilyOfFour = () => {
    // Add 1 adult + 2 children, copy primary's lastName for cohesion.
    if (!primary) return
    const ln = primary.lastName
    addPassenger("adult")
    addPassenger("child")
    addPassenger("child")
    requestAnimationFrame(() => {
      const latest = draftStore.getState().passengers
      const added = latest.slice(-3)
      added.forEach((p) => {
        if (ln) updatePassenger(p.localId, { lastName: ln })
      })
      setExpandedIds((prev) => {
        const next = new Set(prev)
        added.forEach((p) => next.add(p.localId))
        return next
      })
    })
  }

  if (!primary) {
    // Defensive — the store always seeds a primary, but guard against
    // race conditions during persisted-state migration.
    return null
  }

  // ── Live total ──────────────────────────────────────────────────────────
  const counts = passengers.reduce(
    (acc, p) => {
      acc[p.kind].count += 1
      acc[p.kind].sum += p.priceEur
      return acc
    },
    {
      adult: { count: 0, sum: 0 },
      child: { count: 0, sum: 0 },
      infant: { count: 0, sum: 0 },
    } as Record<PassengerKind, { count: number; sum: number }>,
  )
  const subtotal = counts.adult.sum + counts.child.sum + counts.infant.sum
  const total = subtotal // hotel slot is TBD (Task 8)
  const commission = Math.round(total * 0.1)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18rem]">
      {/* ── Main column ─────────────────────────────────────────────── */}
      <div className="space-y-6">
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t("travelers.primaryContact")}
          </h3>
          <TravelerCard
            passenger={primary}
            trip={trip}
            matches={matchesQuery.data ?? []}
            isMatchesLoading={matchesQuery.isFetching}
            expanded={expandedIds.has(primary.localId)}
            onToggleExpand={() => toggleExpand(primary.localId)}
            onUpdate={(patch) => updatePassenger(primary.localId, patch)}
            onUseExisting={(clientId) =>
              updatePassenger(primary.localId, {
                clientId,
                matchIgnored: false,
              })
            }
            onIgnoreMatch={() =>
              updatePassenger(primary.localId, { matchIgnored: true })
            }
            onRestoreMatch={(clientId) =>
              restoreClient.mutate(
                { id: clientId },
                {
                  onSuccess: () =>
                    updatePassenger(primary.localId, {
                      clientId,
                      matchIgnored: false,
                    }),
                },
              )
            }
            isRestoring={restoreClient.isPending}
          />
          {/* If primary is collapsed but a match still requires resolution,
              surface the panel above the additional-travelers section so
              the manager doesn't lose it. */}
          {!expandedIds.has(primary.localId) &&
            !primary.clientId &&
            !primary.matchIgnored &&
            (matchesQuery.data?.length ?? 0) > 0 && (
              <ClientMatchPanel
                matches={matchesQuery.data ?? []}
                isLoading={matchesQuery.isFetching}
                onUseExisting={(id) =>
                  updatePassenger(primary.localId, {
                    clientId: id,
                    matchIgnored: false,
                  })
                }
                onIgnore={() =>
                  updatePassenger(primary.localId, { matchIgnored: true })
                }
                onRestore={(id) =>
                  restoreClient.mutate(
                    { id },
                    {
                      onSuccess: () =>
                        updatePassenger(primary.localId, {
                          clientId: id,
                          matchIgnored: false,
                        }),
                    },
                  )
                }
                isRestoring={restoreClient.isPending}
              />
            )}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {extras.length > 0
              ? t("travelers.additionalCount", { count: extras.length })
              : t("travelers.additional")}
          </h3>
          <div className="space-y-2">
            {extras.map((p) => (
              <div key={p.localId} className="space-y-2">
                <TravelerCard
                  passenger={p}
                  trip={trip}
                  matches={null}
                  isMatchesLoading={false}
                  expanded={expandedIds.has(p.localId)}
                  onToggleExpand={() => toggleExpand(p.localId)}
                  onUpdate={(patch) => updatePassenger(p.localId, patch)}
                  onPromote={editMode ? undefined : () => setPromotingId(p.localId)}
                  onMakePrimary={editMode ? undefined : () => setPrimary(p.localId)}
                  onRemove={
                    editMode
                      ? undefined
                      : () => {
                          removePassenger(p.localId)
                          setExpandedIds((prev) => {
                            const next = new Set(prev)
                            next.delete(p.localId)
                            return next
                          })
                          if (promotingId === p.localId) setPromotingId(null)
                        }
                  }
                />
                {promotingId === p.localId && (
                  <SaveAsClientForm
                    passenger={p}
                    onSaved={(clientId) => {
                      // Mark this passenger as promoted/linked to the new
                      // client so the booking submit knows not to re-create.
                      updatePassenger(p.localId, {
                        clientId,
                        promoteToClient: true,
                      })
                      setPromotingId(null)
                    }}
                    onCancel={() => setPromotingId(null)}
                  />
                )}
              </div>
            ))}
          </div>

          {!editMode && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleAdd("adult")}
                title="Alt+N"
              >
                <Plus className="size-4" />
                {t("travelers.add")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleFamilyOfFour}
                title="Alt+F"
              >
                <Users className="size-4" />
                {t("travelers.familyOfFour")}
              </Button>
            </div>
          )}
        </section>
      </div>

      {/* ── Right rail: live total ──────────────────────────────────── */}
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-md border bg-card p-3 text-sm">
          <h3 className="mb-2 text-sm font-medium">
            {t("travelers.liveTotal")}
          </h3>
          <dl className="space-y-1.5">
            {counts.adult.count > 0 && (
              <Line
                label={t("travelers.lineAdult", {
                  count: counts.adult.count,
                  amount: formatCurrency(
                    counts.adult.count > 0
                      ? counts.adult.sum / counts.adult.count
                      : 0,
                    locale,
                  ),
                })}
                value={formatCurrency(counts.adult.sum, locale)}
              />
            )}
            {counts.child.count > 0 && (
              <Line
                label={t("travelers.lineChild", {
                  count: counts.child.count,
                  amount: formatCurrency(
                    counts.child.count > 0
                      ? counts.child.sum / counts.child.count
                      : 0,
                    locale,
                  ),
                })}
                value={formatCurrency(counts.child.sum, locale)}
              />
            )}
            {counts.infant.count > 0 && (
              <Line
                label={t("travelers.lineInfant", {
                  count: counts.infant.count,
                  amount: formatCurrency(
                    counts.infant.count > 0
                      ? counts.infant.sum / counts.infant.count
                      : 0,
                    locale,
                  ),
                })}
                value={formatCurrency(counts.infant.sum, locale)}
              />
            )}
            <hr className="my-1" />
            <Line
              label={t("travelers.subtotal")}
              value={formatCurrency(subtotal, locale)}
            />
            <Line
              label={t("travelers.hotelNotSet")}
              value="—"
              muted
            />
            <hr className="my-1" />
            <Line
              label={t("travelers.total")}
              value={formatCurrency(total, locale)}
              bold
            />
            <Line
              label={t("travelers.commission")}
              value={formatCurrency(commission, locale)}
              muted
            />
          </dl>
        </div>
      </aside>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Line({
  label,
  value,
  bold,
  muted,
}: {
  label: string
  value: string
  bold?: boolean
  muted?: boolean
}) {
  return (
    <div
      className={[
        "flex items-baseline justify-between gap-2",
        bold ? "text-base font-semibold" : "text-sm",
        muted ? "text-muted-foreground" : "",
      ].join(" ")}
    >
      <dt className="truncate">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

// canContinue derivation lives in @/hooks/use-travelers-can-continue.ts so
// the page-level wizard can import it without pulling in the step component
// (and so this file remains export-only-components for fast-refresh).
