import type { Session, User } from "@supabase/supabase-js"
import { create } from "zustand"

import { queryClient } from "@/lib/query-client"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database"

/**
 * Thrown when authentication succeeds but the user has no active
 * tenant_users row. The store treats this as a login failure: the
 * just-created session is revoked via signOut() and this typed error is
 * returned so the UI can render a specific banner instead of the generic
 * "invalid credentials" one.
 */
export class NoTenantError extends Error {
  constructor() {
    super("no_tenant")
    this.name = "NoTenantError"
  }
}

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

export const useAuthStore = create<AuthState>((set) => ({
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
      } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        // TOKEN_REFRESHED and USER_UPDATED fire on silent token refreshes
        // and metadata updates. Tenant + role can't change mid-session in
        // Etap 1, so we skip the tenant_users SELECT and just update the
        // session/user fields. SIGNED_IN / SIGNED_OUT / INITIAL_SESSION /
        // PASSWORD_RECOVERY all need the full hydrate.
        if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          set({ session: newSession, user: newSession?.user ?? null })
          return
        }

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
    // Hydrate inline (rather than waiting for onAuthStateChange) so the
    // caller can navigate deterministically after this resolves. The
    // subscription will still fire SIGNED_IN shortly after and re-run
    // hydrateFromSession idempotently — accepted cost for simpler control
    // flow at the call site.
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error }
    if (!data.session) {
      // signInWithPassword resolves with either error or session; this
      // branch is defensive against future supabase-js shape changes.
      return { error: new Error("no_session") }
    }

    const { tenant, role } = await hydrateFromSession(data.session)
    if (!tenant) {
      // No active tenant_users row — revoke the session we just created
      // so the deactivated/unprovisioned user doesn't keep a JWT in
      // localStorage, then surface a typed error. If signOut itself
      // rejects (e.g. network blip), swallow the failure so the form
      // still receives a structured { error } return — the unrevoked
      // JWT is the lesser harm than an uncaught promise rejection
      // breaking the form's error handling.
      await supabase.auth.signOut().catch((err) => {
        console.error("auth-store: signOut after no-tenant failed", err)
      })
      return { error: new NoTenantError() }
    }

    set({
      session: data.session,
      user: data.session.user,
      tenant,
      role,
      isLoading: false,
    })
    return { error: null }
  },

  /**
   * Signs the user out and immediately wipes the react-query in-memory
   * cache. Without the clear(), a subsequent component render on a shared
   * workstation could briefly expose the previous user's tenant data before
   * the router redirects to /login. queryClient is a module-level singleton
   * from @/lib/query-client, so it is safe to call here outside of a hook.
   */
  signOut: async () => {
    await supabase.auth.signOut()
    // Prevent cross-user cache leakage on shared devices.
    queryClient.clear()
    // onAuthStateChange handles state reset; explicit set() here is a
    // belt-and-suspenders fallback in case the subscription hasn't been
    // attached yet (e.g. signOut called before init completes).
    set({ session: null, user: null, tenant: null, role: null })
  },
}))
