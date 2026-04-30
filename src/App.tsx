import { QueryClientProvider } from "@tanstack/react-query"
import { useEffect } from "react"
import { RouterProvider } from "react-router"

import { ThemeProvider } from "@/components/layout/theme-provider"
import { queryClient } from "@/lib/query-client"
import { router } from "@/router"
import { useAuthStore } from "@/stores/auth-store"

export default function App() {
  const init = useAuthStore((s) => s.init)

  // Bootstrap the auth store once on app boot. The store internally
  // guards against duplicate subscriptions, so React StrictMode's
  // double-invoke pattern is safe.
  useEffect(() => {
    void init()
  }, [init])

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
