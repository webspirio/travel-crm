import { useAuthStore } from "@/stores/auth-store"

/**
 * Selector over auth-store exposing the current tenant + role + loading
 * state. Re-renders only when one of those slices changes.
 *
 * Returns nullable tenant/role so callers in unauthenticated contexts
 * (login page) can read it without crashing. Pages behind the auth
 * boundary should narrow on `tenant` early — typically via
 * `if (!tenant) return <Loading />` in the page shell.
 */
export function useCurrentTenant() {
  return useAuthStore((s) => ({
    tenant: s.tenant,
    role: s.role,
    isLoading: s.isLoading,
  }))
}
