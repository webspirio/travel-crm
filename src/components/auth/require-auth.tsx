// src/components/auth/require-auth.tsx
import { Navigate, Outlet, useLocation } from "react-router"

import { useAuthStore } from "@/stores/auth-store"

/**
 * Route element wrapper. If the user is not authenticated, redirects to
 * /login with a `redirect` query param that captures the original
 * pathname + search so they can return after sign-in.
 *
 * Mounted once around the protected RootLayout in src/router.tsx — every
 * protected child inherits the gate.
 *
 * Note: AuthGate ensures isLoading is false before this runs, so we
 * never see indeterminate state here.
 */
export function RequireAuth() {
  const session = useAuthStore((s) => s.session)
  const location = useLocation()

  if (!session) {
    const target = location.pathname + location.search
    const redirect = encodeURIComponent(target)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  return <Outlet />
}
