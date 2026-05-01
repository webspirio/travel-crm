import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { UseMutationResult } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/auth-store"
import { clientsKeys } from "@/hooks/queries/use-clients"
import { clientMatchesKeys, type ClientMatch } from "@/hooks/queries/use-client-matches"

export interface PromotePassengerInput {
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  phoneE164: string | null
  nationality: "UA" | "DE" | null
  birthDate: string | null
  /** When true, skip the find_client_matches pre-flight and insert directly. */
  forceCreate: boolean
}

export interface PromotePassengerResult {
  /**
   * Non-null when existing clients match the passenger data AND
   * forceCreate=false. The caller should present these to the user and ask
   * them to confirm or select one before proceeding.
   */
  matched: ClientMatch[] | null
  /** Non-null when a new client row was inserted. */
  createdClientId: string | null
}

/**
 * "Save as client" action for an extra passenger.
 *
 * First pass (forceCreate=false): runs find_client_matches as a pre-flight.
 *   • If matches are found → returns { matched, createdClientId: null }.
 *     The UI should prompt the user to confirm or pick a match.
 *   • If no matches → inserts and returns { matched: null, createdClientId }.
 *
 * Second pass (forceCreate=true): skips the pre-flight and inserts directly,
 * returning { matched: null, createdClientId }.
 *
 * On insert success: invalidates clients lists and client-matches cache.
 */
export function usePromotePassenger(): UseMutationResult<
  PromotePassengerResult,
  Error,
  PromotePassengerInput
> {
  const queryClient = useQueryClient()

  return useMutation<PromotePassengerResult, Error, PromotePassengerInput>({
    mutationFn: async (input) => {
      const { tenant } = useAuthStore.getState()
      if (!tenant?.id) throw new Error("no_session")

      // ── Pre-flight: look for duplicate clients ─────────────────────────
      if (!input.forceCreate) {
        const hasIdentifier =
          Boolean(input.email) ||
          Boolean(input.phoneE164) ||
          (Boolean(input.firstName) && Boolean(input.lastName))

        if (hasIdentifier) {
          const { data: matchData, error: matchErr } = await supabase.rpc(
            "find_client_matches",
            {
              _tenant_id: tenant.id,
              _email: input.email ?? undefined,
              _phone_e164: input.phoneE164 ?? undefined,
              _first_name: input.firstName ?? undefined,
              _last_name: input.lastName ?? undefined,
            },
          )
          if (matchErr) throw matchErr
          const matches = (matchData ?? []).map((row) => ({
            id: row.id,
            firstName: row.first_name,
            lastName: row.last_name,
            email: row.email ?? null,
            phone: row.phone ?? null,
            nationality: row.nationality ?? null,
            deletedAt: row.deleted_at ?? null,
            matchKind: row.match_kind as "email" | "phone" | "name",
            score: row.score,
          }))
          if (matches.length > 0) {
            return { matched: matches, createdClientId: null }
          }
        }
      }

      // ── Insert new client ──────────────────────────────────────────────
      const { data: newClient, error: insertErr } = await supabase
        .from("clients")
        .insert({
          tenant_id: tenant.id,
          first_name: input.firstName,
          last_name: input.lastName,
          email: input.email ?? "",
          phone: input.phone ?? input.phoneE164 ?? "",
          nationality: input.nationality ?? undefined,
          ...(input.birthDate !== null ? { birth_date: input.birthDate } : {}),
        })
        .select("id")
        .single()

      if (insertErr) throw insertErr
      return { matched: null, createdClientId: newClient.id }
    },

    onSuccess: ({ createdClientId }) => {
      if (createdClientId) {
        void queryClient.invalidateQueries({ queryKey: clientsKeys.lists() })
        void queryClient.invalidateQueries({ queryKey: clientMatchesKeys.all })
      }
    },
  })
}
