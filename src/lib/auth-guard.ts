import type { QueryClient } from "@tanstack/react-query"
import type { Database } from "@/types/database"

import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/stores/auth-store"

type ManagerRow = Database["public"]["Tables"]["managers"]["Row"]

/**
 * Returns the current tenant id and user id. Throws Error("no_session") if
 * there is no active session. Reads from useAuthStore.getState() — safe to
 * call inside a react-query mutationFn (not a hook).
 */
export function requireTenant(): { tenantId: string; userId: string } {
  const { tenant, user } = useAuthStore.getState()
  if (!tenant?.id || !user?.id) throw new Error("no_session")
  return { tenantId: tenant.id, userId: user.id }
}

/**
 * Returns the current user's managers row id. Tries the react-query cache
 * key ["managers","me",userId] first (matches useCurrentManager's key); falls
 * back to a fresh SELECT on miss. Throws Error("no_manager") when the user
 * has no active managers row.
 */
export async function resolveManagerId(
  queryClient: QueryClient,
  userId: string,
): Promise<string> {
  const cached = queryClient.getQueryData<ManagerRow | null>(["managers", "me", userId])
  if (cached?.id) return cached.id

  const { data, error } = await supabase
    .from("managers")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data?.id) throw new Error("no_manager")
  return data.id
}
