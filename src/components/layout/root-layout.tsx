import { Outlet } from "react-router"

import { CommandPalette } from "@/components/command-palette"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"

import { AppSidebar } from "./app-sidebar"
import { SiteHeader } from "./site-header"

export function RootLayout() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <main className="flex-1 p-4 lg:p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
      <CommandPalette />
      <Toaster richColors position="top-right" />
    </TooltipProvider>
  )
}
