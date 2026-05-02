import { useQuery } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import type { Manager } from "@/types"
import type { Database } from "@/types/database"

type ManagerRow = Database["public"]["Tables"]["managers"]["Row"]

// Adapter: DB row → UI Manager type. We pre-load tenant_users in a
// separate query keyed by user_id so we can derive the UI role
// ('manager' | 'owner'). There's no FK from managers → tenant_users
// (both reference auth.users), so the embedded-select form Postgrest
// expects isn't available — a parallel fetch + TS join is the right
// shape for the picker UI.
function toManager(row: ManagerRow, role: string | undefined): Manager {
  const uiRole: "manager" | "owner" = role === "owner" ? "owner" : "manager"
  return {
    id: row.id,
    name: row.display_name,
    email: row.email,
    phone: row.phone ?? "",
    role: uiRole,
    avatarUrl: row.avatar_url ?? undefined,
  }
}

async function loadRolesByUserId(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from("tenant_users")
    .select("user_id, role")
    .in("user_id", userIds)
    .eq("is_active", true)
  if (error) throw error
  return new Map((data ?? []).map((r) => [r.user_id, r.role]))
}

export const managersKeys = {
  all: ["managers"] as const,
  lists: () => [...managersKeys.all, "list"] as const,
  detail: (id: string) => [...managersKeys.all, "detail", id] as const,
}

export function useManagers() {
  return useQuery({
    queryKey: managersKeys.lists(),
    queryFn: async (): Promise<Manager[]> => {
      const { data, error } = await supabase
        .from("managers")
        .select("*")
        .eq("is_active", true)
        .order("display_name")
      if (error) throw error
      const rows = data ?? []
      const roles = await loadRolesByUserId(rows.map((r) => r.user_id))
      return rows.map((row) => toManager(row, roles.get(row.user_id)))
    },
  })
}

export function useManagerById(id: string | undefined) {
  return useQuery({
    queryKey: managersKeys.detail(id ?? ""),
    queryFn: async (): Promise<Manager | null> => {
      const { data, error } = await supabase
        .from("managers")
        .select("*")
        .eq("id", id!)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const roles = await loadRolesByUserId([data.user_id])
      return toManager(data, roles.get(data.user_id))
    },
    enabled: !!id,
  })
}
