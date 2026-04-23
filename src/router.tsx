import { lazy, Suspense } from "react"
import { createHashRouter } from "react-router"

import { RootLayout } from "@/components/layout/root-layout"
import { Skeleton } from "@/components/ui/skeleton"

const DashboardPage = lazy(() => import("@/pages/dashboard"))
const TripsListPage = lazy(() => import("@/pages/trips/list"))
const TripDetailPage = lazy(() => import("@/pages/trips/detail"))
const ClientsListPage = lazy(() => import("@/pages/clients/list"))
const NewBookingPage = lazy(() => import("@/pages/bookings/new"))

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
        element: lazyWrap(ClientsListPage),
        handle: { titleKey: "nav.clients" },
      },
      {
        path: "bookings/new",
        element: lazyWrap(NewBookingPage),
        handle: { titleKey: "nav.newBooking" },
      },
    ],
  },
])
