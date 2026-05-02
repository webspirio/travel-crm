import { isValidPhoneNumber } from "libphonenumber-js"

import { useClientMatches } from "@/hooks/queries/use-client-matches"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import { useAuthStore } from "@/stores/auth-store"
import { useBookingDraft } from "@/lib/booking-draft-context"

/**
 * Returns whether the Travelers step is complete enough to advance.
 *
 * Gates:
 *   • Primary has firstName, lastName, valid email, valid E.164 phone, nationality.
 *   • Each extra has firstName, lastName, kind.
 *   • No unresolved live email match (live + score 100 + !matchIgnored + !clientId).
 *
 * If primary is locked to an existing clientId, contact-field validation is
 * skipped — those fields are owned by the existing clients row.
 *
 * Lives in @/hooks (not co-located with the step) so the page-level wizard
 * can call it without importing the step component, and so file-level lint
 * (react-refresh/only-export-components) stays happy.
 */
export function useTravelersCanContinue(): boolean {
  const passengers = useBookingDraft((s) => s.passengers)
  const tenantId = useAuthStore((s) => s.tenant?.id ?? null)

  const primary = passengers[0]

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

  if (!primary) return false

  // If primary is bound to an existing client, contact-field validation
  // is skipped — those fields belong to the existing clients row.
  if (!primary.clientId) {
    if (!primary.firstName || !primary.lastName) return false
    if (!primary.email) return false
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primary.email)) return false
    if (!primary.phoneRaw || !isValidPhoneNumber(primary.phoneRaw)) return false
    if (!primary.nationality) return false

    // Soft-block on unresolved live email match.
    const liveEmailMatch = (matchesQuery.data ?? []).some(
      (m) => m.matchKind === "email" && !m.deletedAt && m.score >= 100,
    )
    if (liveEmailMatch && !primary.matchIgnored) return false
  }

  // Each extra needs name + kind.
  for (const p of passengers.slice(1)) {
    if (!p.firstName || !p.lastName) return false
    if (!p.kind) return false
  }

  return true
}
