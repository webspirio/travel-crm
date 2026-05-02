// src/components/auth/require-anon.tsx
import { Navigate, Outlet, useSearchParams } from "react-router"

import { validateRedirect } from "@/lib/validate-redirect"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Reverse route guard. If the user IS authenticated, redirects them away
 * from the wrapped public route (login). The redirect target is the
 * `redirect` query param when present (and validated), else "/".
 *
 * Wraps the /login route in src/router.tsx.
 */
export function RequireAnon() {
  const session = useAuthStore((s) => s.session)
  const [params] = useSearchParams()

  if (session) {
    const target = validateRedirect(params.get("redirect")) ?? "/"
    return <Navigate to={target} replace />
  }

  return <Outlet />
}
