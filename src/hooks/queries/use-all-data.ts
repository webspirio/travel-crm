import { useBookings } from "./use-bookings"
import { useClients } from "./use-clients"
import { useHotels } from "./use-hotels"
import { useManagers } from "./use-managers"
import { useTrips } from "./use-trips"

/**
 * Convenience aggregator for pages that need most or all of the
 * top-level catalogs at once (dashboard, finance, calendar). React-
 * query dedupes overlapping queries across components, so calling
 * this from one page and useTrips() from another doesn't double-fetch.
 *
 * Returns a single `isLoading` (true while ANY of the underlying
 * queries hasn't resolved) and the five arrays. Errors propagate via
 * react-query's queryClient onError; pages that need granular error
 * handling should call the individual hooks directly.
 */
export function useAllData() {
  const managers = useManagers()
  const clients = useClients()
  const hotels = useHotels()
  const trips = useTrips()
  const bookings = useBookings()

  const isLoading =
    managers.isLoading ||
    clients.isLoading ||
    hotels.isLoading ||
    trips.isLoading ||
    bookings.isLoading

  return {
    managers: managers.data ?? [],
    clients: clients.data ?? [],
    hotels: hotels.data ?? [],
    trips: trips.data ?? [],
    bookings: bookings.data ?? [],
    isLoading,
  }
}
