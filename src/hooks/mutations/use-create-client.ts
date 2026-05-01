import { useMutation, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { clientsKeys } from "@/hooks/queries/use-clients"
import { useAuthStore } from "@/stores/auth-store"
import type { Database } from "@/types/database"

type ClientRow = Database["public"]["Tables"]["clients"]["Row"]

export interface CreateClientInput {
  firstName: string
  lastName: string
  email: string
  phone: string
  nationality: "UA" | "DE"
  birthDate: Date | null
  notes?: string | null
}

/**
 * Inserts a new client row for the current tenant.
 *
 * Auth is read inside mutationFn via useAuthStore.getState() — call sites
 * do NOT pass tenantId. Throws Error("no_session") when the store has no
 * active tenant.
 *
 * On success: invalidates clientsKeys.lists() so the clients list refetches.
 * Does NOT invalidate clientsKeys.all (deleted-clients list doesn't need it).
 */
export function useCreateClient() {
  const queryClient = useQueryClient()

  return useMutation<ClientRow, Error, CreateClientInput>({
    mutationFn: async (input) => {
      const { tenant } = useAuthStore.getState()
      if (!tenant?.id) throw new Error("no_session")

      const birthDateStr = input.birthDate
        ? input.birthDate.toISOString().split("T")[0]
        : null

      const { data, error } = await supabase
        .from("clients")
        .insert({
          tenant_id: tenant.id,
          first_name: input.firstName,
          last_name: input.lastName,
          email: input.email,
          phone: input.phone,
          nationality: input.nationality,
          ...(birthDateStr !== null ? { birth_date: birthDateStr } : {}),
        })
        .select()
        .single()

      if (error) throw error
      return data
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientsKeys.lists() })
    },
  })
}
