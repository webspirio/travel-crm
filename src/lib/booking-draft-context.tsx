import { createContext, useContext, type ReactNode } from "react"
import { useStore, type StoreApi } from "zustand"

import { useBookingStore, type BookingStore } from "@/stores/booking-store"

const BookingDraftContext = createContext<StoreApi<BookingStore> | null>(null)

export function BookingDraftProvider({
  store,
  children,
}: {
  store: StoreApi<BookingStore>
  children: ReactNode
}) {
  return (
    <BookingDraftContext.Provider value={store}>
      {children}
    </BookingDraftContext.Provider>
  )
}

/**
 * Subscribe to draft state. Resolves to the context-provided store
 * (edit-sheet mode) when present, else the wizard's persisted store.
 *
 * Important: this hook always calls `useStore(...)` once per render, so
 * the rules of hooks are respected even though the underlying store may
 * differ between renders if a Provider is added/removed (don't do that).
 */
export function useBookingDraft<T>(selector: (s: BookingStore) => T): T {
  const ctx = useContext(BookingDraftContext)
  return useStore(ctx ?? useBookingStore, selector)
}

/**
 * Returns the resolved StoreApi (context-provided or wizard's persisted store).
 * Use this in event handlers / async callbacks where a `useBookingDraft.getState()`-style
 * imperative read is needed. The returned value is stable for the lifetime of
 * the surrounding tree (Provider's `store` prop is expected to be stable).
 */
export function useBookingDraftStore(): StoreApi<BookingStore> {
  const ctx = useContext(BookingDraftContext)
  return ctx ?? useBookingStore
}
