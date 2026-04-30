import type { Session, User } from "@supabase/supabase-js"
import { create } from "zustand"

import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database"

type TenantRow = Database["public"]["Tables"]["tenants"]["Row"]
type TenantUserRole = Database["public"]["Enums"]["tenant_role"]

interface AuthState {
  session: Session | null
  user: User | null
  tenant: TenantRow | null
  role: TenantUserRole | null
  isLoading: boolean

  /**
   * Bootstrap auth state. Call once on app boot. Reads the persisted
   * session from supabase-js, hydrates tenant/role from tenant_users,
   * and subscribes to auth state changes (login / logout / token
   * refresh) for the lifetime of the app. Idempotent — multiple calls
   * coalesce.
   */
  init: () => Promise<void>

  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

let authSubscription: { unsubscribe: () => void } | null = null

async function hydrateFromSession(session: Session | null): Promise<{
  tenant: TenantRow | null
  role: TenantUserRole | null
}> {
  if (!session) return { tenant: null, role: null }

  // Etap 1 contract: one active tenant_users row per user. Multi-tenant
  // memberships are supported by the schema (composite PK) but UI
  // affordance is deferred to Etap 2.
  const { data, error } = await supabase
    .from("tenant_users")
    .select("role, tenants:tenant_id(*)")
    .eq("user_id", session.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("auth-store: failed to hydrate tenant_users", error)
    return { tenant: null, role: null }
  }

  return {
    tenant: (data?.tenants as TenantRow | null) ?? null,
    role: (data?.role as TenantUserRole | null) ?? null,
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  tenant: null,
  role: null,
  isLoading: true,

  init: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const { tenant, role } = await hydrateFromSession(session)
    set({ session, user: session?.user ?? null, tenant, role, isLoading: false })

    if (!authSubscription) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        const { tenant, role } = await hydrateFromSession(newSession)
        set({
          session: newSession,
          user: newSession?.user ?? null,
          tenant,
          role,
          isLoading: false,
        })
      })
      authSubscription = subscription
    }
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) await get().init()
    return { error }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    // onAuthStateChange handles state reset; explicit set() here is a
    // belt-and-suspenders fallback in case the subscription hasn't been
    // attached yet (e.g. signOut called before init completes).
    set({ session: null, user: null, tenant: null, role: null })
  },
}))
