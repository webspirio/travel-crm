import { useQuery } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import type { Client } from "@/types"
import type { Database } from "@/types/database"

type ClientRow = Database["public"]["Tables"]["clients"]["Row"]

function toClient(row: ClientRow): Client {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    nationality: (row.nationality as "UA" | "DE") ?? "UA",
    birthDate: row.birth_date ? new Date(row.birth_date) : new Date(0),
    notes: row.notes ?? undefined,
    createdAt: new Date(row.created_at),
  }
}

export const clientsKeys = {
  all: ["clients"] as const,
  lists: () => [...clientsKeys.all, "list"] as const,
  detail: (id: string) => [...clientsKeys.all, "detail", id] as const,
  deleted: () => [...clientsKeys.all, "deleted"] as const,
}

export function useClients() {
  return useQuery({
    queryKey: clientsKeys.lists(),
    queryFn: async (): Promise<Client[]> => {
      // RLS allows owners to see deleted rows via the soft-delete branch
      // of clients_select; the main list filters them client-side.
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []).map(toClient)
    },
  })
}

export function useClientById(id: string | undefined) {
  return useQuery({
    queryKey: clientsKeys.detail(id ?? ""),
    queryFn: async (): Promise<Client | null> => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id!)
        .maybeSingle()
      if (error) throw error
      return data ? toClient(data) : null
    },
    enabled: !!id,
  })
}

// Owner-only: surfaces soft-deleted rows for the restoration UI.
// The clients_select_deleted_owners policy enforces the owner role at
// the DB layer; non-owners get an empty result set.
export function useDeletedClients() {
  return useQuery({
    queryKey: clientsKeys.deleted(),
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
      if (error) throw error
      return (data ?? []).map(toClient)
    },
  })
}
