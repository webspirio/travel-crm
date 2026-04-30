// src/components/auth/auth-gate.tsx
import type { ReactNode } from "react"

import { SplashScreen } from "@/components/auth/splash-screen"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Renders children only after the auth store has finished its initial
 * hydrate. Sits ABOVE the router so the splash also covers /login —
 * preventing a flicker where an already-authenticated user briefly sees
 * the login form before <RequireAnon> redirects them.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const isLoading = useAuthStore((s) => s.isLoading)
  if (isLoading) return <SplashScreen />
  return <>{children}</>
}
