import { LayoutDashboard, Bus, Users, PlusCircle } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface NavItem {
  titleKey: string
  path: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { titleKey: "nav.dashboard", path: "/", icon: LayoutDashboard },
  { titleKey: "nav.trips", path: "/trips", icon: Bus },
  { titleKey: "nav.clients", path: "/clients", icon: Users },
  { titleKey: "nav.newBooking", path: "/bookings/new", icon: PlusCircle },
]
