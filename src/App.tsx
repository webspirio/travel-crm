import { RouterProvider } from "react-router"

import { ThemeProvider } from "@/components/layout/theme-provider"
import { router } from "@/router"

export default function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  )
}
