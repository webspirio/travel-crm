import { QueryClient } from "@tanstack/react-query"

// RLS rejections, expired sessions, and forbidden writes are terminal —
// retrying them just hammers Postgres without changing the outcome.
// Postgres-PostgREST surfaces RLS denials with status 401/403 (auth) or
// 42501 (insufficient privilege). All three are skipped from retry.
function shouldRetry(failureCount: number, error: unknown): boolean {
  const e = error as { status?: number; code?: string }
  if (e?.status === 401 || e?.status === 403) return false
  if (e?.code === "42501") return false
  return failureCount < 2
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      // 30s default keeps lists fresh enough for a multi-user CRM while
      // letting react-query dedupe rapid re-renders.
      staleTime: 30_000,
    },
  },
})
