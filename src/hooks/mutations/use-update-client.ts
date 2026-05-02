import { useMutation, useQueryClient } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { bookingsKeys } from "@/hooks/queries/use-bookings"
import { clientsKeys } from "@/hooks/queries/use-clients"
import { useAuthStore } from "@/stores/auth-store"
import type { CreateClientInput } from "./use-create-client"
import type { Database } from "@/types/database"

type ClientRow = Database["public"]["Tables"]["clients"]["Row"]

export interface UpdateClientInput {
  id: string
  patch: Partial<CreateClientInput>
}

/**
 * Updates an existing client row by id.
 *
 * Auth is read inside mutationFn via useAuthStore.getState() — only used
 * as a guard; the RLS policy enforces tenant isolation at the DB layer.
 * Throws Error("no_session") when the store has no active session.
 *
 * Only the fields present in `patch` are sent to the DB; undefined fields
 * are omitted entirely.
 *
 * On success: invalidates clientsKeys.detail(id), clientsKeys.lists(), and
 * bookingsKeys.all — the bookings list joins client first/last names into
 * client_full_name on bookings_search_view, so any name edit must refresh
 * booking-related queries. Low-frequency mutation, so the broad .all prefix
 * is acceptable over-invalidation.
 */
export function useUpdateClient() {
  const queryClient = useQueryClient()

  return useMutation<ClientRow, Error, UpdateClientInput>({
    mutationFn: async ({ id, patch }) => {
      const { tenant } = useAuthStore.getState()
      if (!tenant?.id) throw new Error("no_session")

      // Build the DB-shaped update object, skipping undefined fields.
      const dbPatch: Database["public"]["Tables"]["clients"]["Update"] = {}

      if (patch.firstName !== undefined) dbPatch.first_name = patch.firstName
      if (patch.lastName !== undefined) dbPatch.last_name = patch.lastName
      if (patch.email !== undefined) dbPatch.email = patch.email
      if (patch.phone !== undefined) dbPatch.phone = patch.phone
      if (patch.nationality !== undefined) dbPatch.nationality = patch.nationality
      if (patch.birthDate !== undefined) {
        dbPatch.birth_date = patch.birthDate
          ? patch.birthDate.toISOString().split("T")[0]
          : null
      }
      if (patch.notes !== undefined) dbPatch.notes = patch.notes

      const { data, error } = await supabase
        .from("clients")
        .update(dbPatch)
        .eq("id", id)
        .select()
        .single()

      if (error) throw error
      return data
    },

    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: clientsKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: clientsKeys.lists() })
      // bookings_search_view joins client first/last → client_full_name; any
      // name edit must refresh booking lists/details that display this column.
      void queryClient.invalidateQueries({ queryKey: bookingsKeys.all })
    },
  })
}
