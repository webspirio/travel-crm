import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { UseMutationResult } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { clientsKeys } from "@/hooks/queries/use-clients"
import { clientMatchesKeys } from "@/hooks/queries/use-client-matches"

/**
 * Calls the `restore_client` RPC to un-soft-delete a client row.
 *
 * RLS gates this to owner-or-manager; callers with insufficient privilege
 * will receive no error but the row won't be restored. On success both the
 * clients list and any client-matches cache are invalidated.
 */
export function useRestoreClient(): UseMutationResult<void, Error, { id: string }> {
  const queryClient = useQueryClient()

  return useMutation<void, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.rpc("restore_client", { _id: id })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientsKeys.all })
      void queryClient.invalidateQueries({ queryKey: clientMatchesKeys.all })
    },
  })
}
