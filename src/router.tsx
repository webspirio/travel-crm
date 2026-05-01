import { lazy, Suspense } from "react"
import { createHashRouter } from "react-router"

import { RequireAnon } from "@/components/auth/require-anon"
import { RequireAuth } from "@/components/auth/require-auth"
import { RootLayout } from "@/components/layout/root-layout"
import { Skeleton } from "@/components/ui/skeleton"

const DashboardPage = lazy(() => import("@/pages/dashboard"))
const TripsListPage = lazy(() => import("@/pages/trips/list"))
const TripDetailPage = lazy(() => import("@/pages/trips/detail"))
const ClientsListPage = lazy(() => import("@/pages/clients/list"))
const ClientDetailPage = lazy(() => import("@/pages/clients/detail"))
const NewBookingPage = lazy(() => import("@/pages/bookings/new"))
const BookingDetailPage = lazy(() => import("@/pages/bookings/detail"))
const HotelsListPage = lazy(() => import("@/pages/hotels/list"))
const HotelDetailPage = lazy(() => import("@/pages/hotels/detail"))
const CalendarPage = lazy(() => import("@/pages/calendar"))
const FinancePage = lazy(() => import("@/pages/finance"))
const ManagersListPage = lazy(() => import("@/pages/managers/list"))
const ManagerDetailPage = lazy(() => import("@/pages/managers/detail"))
const ProposalPage = lazy(() => import("@/pages/proposal/proposal-page"))
const LoginPage = lazy(() => import("@/pages/login"))

function PageFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

const lazyWrap = (Component: React.LazyExoticComponent<React.ComponentType>) => (
  <Suspense fallback={<PageFallback />}>
    <Component />
  </Suspense>
)

export const router = createHashRouter([
  {
    path: "/",
    Component: RequireAuth,
    children: [
      {
        path: "/",
        Component: RootLayout,
        children: [
          {
            index: true,
            element: lazyWrap(DashboardPage),
            handle: { titleKey: "nav.dashboard" },
          },
          {
            path: "trips",
            handle: { titleKey: "nav.trips" },
            children: [
              { index: true, element: lazyWrap(TripsListPage) },
              {
                path: ":tripId",
                element: lazyWrap(TripDetailPage),
                handle: { titleKey: "nav.trips" },
              },
            ],
          },
          {
            path: "clients",
            handle: { titleKey: "nav.clients" },
            children: [
              { index: true, element: lazyWrap(ClientsListPage) },
              {
                path: ":clientId",
                element: lazyWrap(ClientDetailPage),
                handle: { titleKey: "nav.clients" },
              },
            ],
          },
          {
            path: "hotels",
            handle: { titleKey: "nav.hotels" },
            children: [
              { index: true, element: lazyWrap(HotelsListPage) },
              {
                path: ":hotelId",
                element: lazyWrap(HotelDetailPage),
                handle: { titleKey: "nav.hotels" },
              },
            ],
          },
          {
            path: "calendar",
            element: lazyWrap(CalendarPage),
            handle: { titleKey: "nav.calendar" },
          },
          {
            path: "finance",
            element: lazyWrap(FinancePage),
            handle: { titleKey: "nav.finance" },
          },
          {
            path: "managers",
            handle: { titleKey: "nav.managers" },
            children: [
              { index: true, element: lazyWrap(ManagersListPage) },
              {
                path: ":managerId",
                element: lazyWrap(ManagerDetailPage),
                handle: { titleKey: "nav.managers" },
              },
            ],
          },
          {
            path: "bookings/new",
            element: lazyWrap(NewBookingPage),
            handle: { titleKey: "nav.newBooking" },
          },
          {
            path: "bookings/:bookingId",
            element: lazyWrap(BookingDetailPage),
            handle: { titleKey: "nav.bookings" },
          },
        ],
      },
    ],
  },
  {
    path: "/login",
    Component: RequireAnon,
    children: [{ index: true, element: lazyWrap(LoginPage) }],
  },
  {
    path: "/proposal",
    element: lazyWrap(ProposalPage),
  },
])
