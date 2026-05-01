import { keepPreviousData, useQuery } from "@tanstack/react-query"
import type { UseQueryResult } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"

export interface ClientMatch {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  nationality: string | null
  deletedAt: string | null
  matchKind: "email" | "phone" | "name"
  score: number
}

export interface ClientMatchesParams {
  tenantId: string | null
  email: string | null
  phoneE164: string | null
  firstName: string | null
  lastName: string | null
}

export const clientMatchesKeys = {
  all: ["client-matches"] as const,
  query: (params: ClientMatchesParams) => [...clientMatchesKeys.all, params] as const,
}

/**
 * Wraps the `find_client_matches` RPC. Disabled automatically when tenantId
 * is null or when all of email + phoneE164 + (firstName AND lastName) are
 * empty — there is nothing meaningful to match against.
 *
 * The caller is responsible for debouncing inputs (see useDebouncedValue).
 * keepPreviousData=true ensures the previous list stays visible while a
 * fresh query is in-flight.
 */
export function useClientMatches(params: {
  tenantId: string | null
  email: string | null
  phoneE164: string | null
  firstName: string | null
  lastName: string | null
  enabled?: boolean
}): UseQueryResult<ClientMatch[], Error> {
  const queryParams: ClientMatchesParams = {
    tenantId: params.tenantId,
    email: params.email,
    phoneE164: params.phoneE164,
    firstName: params.firstName,
    lastName: params.lastName,
  }

  const hasIdentifier =
    Boolean(params.email) ||
    Boolean(params.phoneE164) ||
    (Boolean(params.firstName) && Boolean(params.lastName))

  return useQuery({
    queryKey: clientMatchesKeys.query(queryParams),
    queryFn: async (): Promise<ClientMatch[]> => {
      const { data, error } = await supabase.rpc("find_client_matches", {
        _tenant_id: params.tenantId!,
        _email: params.email ?? undefined,
        _phone_e164: params.phoneE164 ?? undefined,
        _first_name: params.firstName ?? undefined,
        _last_name: params.lastName ?? undefined,
      })
      if (error) throw error
      return (data ?? []).map((row) => ({
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
    },
    enabled: params.enabled !== false && Boolean(params.tenantId) && hasIdentifier,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}
