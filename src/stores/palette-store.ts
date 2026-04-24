import { create } from "zustand"

interface PaletteStore {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const usePaletteStore = create<PaletteStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}))
