import { useQuery } from "@tanstack/react-query"

import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database"

export type Route = Database["public"]["Tables"]["routes"]["Row"]
export type RouteStop = Database["public"]["Tables"]["route_stops"]["Row"]

export const routesKeys = {
  all: ["routes"] as const,
  lists: () => [...routesKeys.all, "list"] as const,
  detail: (id: string) => [...routesKeys.all, "detail", id] as const,
  stops: (routeId: string) => [...routesKeys.all, "stops", routeId] as const,
}

export function useRoutes() {
  return useQuery({
    queryKey: routesKeys.lists(),
    queryFn: async (): Promise<Route[]> => {
      const { data, error } = await supabase
        .from("routes")
        .select("*")
        .eq("is_active", true)
        .order("name")
      if (error) throw error
      return data ?? []
    },
  })
}

export function useRouteById(id: string | undefined) {
  return useQuery({
    queryKey: routesKeys.detail(id ?? ""),
    queryFn: async (): Promise<Route | null> => {
      const { data, error } = await supabase
        .from("routes")
        .select("*")
        .eq("id", id!)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useRouteStops(routeId: string | undefined) {
  return useQuery({
    queryKey: routesKeys.stops(routeId ?? ""),
    queryFn: async (): Promise<RouteStop[]> => {
      const { data, error } = await supabase
        .from("route_stops")
        .select("*")
        .eq("route_id", routeId!)
        .order("ord")
      if (error) throw error
      return data ?? []
    },
    enabled: !!routeId,
  })
}
