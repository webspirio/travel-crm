import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

interface ClientNotesStore {
  notes: Record<string, string>
  setNote: (clientId: string, note: string) => void
}

export const useClientNotesStore = create<ClientNotesStore>()(
  persist(
    (set) => ({
      notes: {},
      setNote: (clientId, note) =>
        set((state) => ({ notes: { ...state.notes, [clientId]: note } })),
    }),
    {
      name: "anytour-client-notes",
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
