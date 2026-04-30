import { useQuery } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/auth-store"
import type { Database } from "@/types/database"

type ManagerRow = Database["public"]["Tables"]["managers"]["Row"]

/**
 * Resolves the public.managers row for the currently-authenticated
 * user. Cached by react-query under ['managers', 'me', userId].
 *
 * Returns null when the user is authenticated but has no managers row
 * (Etap 1 contract: every active tenant_user is also a manager —
 * provisioning script enforces this; the null branch exists for
 * defense-in-depth, not as an expected flow).
 */
export function useCurrentManager() {
  const userId = useAuthStore((s) => s.user?.id)

  return useQuery<ManagerRow | null>({
    queryKey: ["managers", "me", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("managers")
        .select("*")
        .eq("user_id", userId!)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!userId,
  })
}
