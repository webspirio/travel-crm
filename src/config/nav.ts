import {
  LayoutDashboard,
  Bus,
  Users,
  PlusCircle,
  Hotel,
  CalendarDays,
  Wallet,
  UserRound,
  FileText,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface NavItem {
  titleKey: string
  path: string
  icon: LucideIcon
  newTab?: boolean
}

export const navItems: NavItem[] = [
  { titleKey: "nav.dashboard", path: "/", icon: LayoutDashboard },
  { titleKey: "nav.trips", path: "/trips", icon: Bus },
  { titleKey: "nav.calendar", path: "/calendar", icon: CalendarDays },
  { titleKey: "nav.hotels", path: "/hotels", icon: Hotel },
  { titleKey: "nav.clients", path: "/clients", icon: Users },
  { titleKey: "nav.managers", path: "/managers", icon: UserRound },
  { titleKey: "nav.finance", path: "/finance", icon: Wallet },
  { titleKey: "nav.newBooking", path: "/bookings/new", icon: PlusCircle },
  { titleKey: "nav.proposal", path: "/proposal", icon: FileText, newTab: true },
]
