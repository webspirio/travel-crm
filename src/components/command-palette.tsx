import { useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import {
  Bus,
  CalendarDays,
  Hotel,
  LayoutDashboard,
  PlusCircle,
  UserRound,
  Users,
  Wallet,
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { clients, hotels, managers, trips } from "@/data"
import { usePaletteStore } from "@/stores/palette-store"

export function CommandPalette() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const open = usePaletteStore((s) => s.open)
  const setOpen = usePaletteStore((s) => s.setOpen)
  const toggle = usePaletteStore((s) => s.toggle)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [toggle])

  const tripItems = useMemo(
    () =>
      trips.map((tr) => ({
        id: tr.id,
        label: tr.name,
        hint: `${tr.origin} → ${tr.destination}`,
        value: `trip ${tr.name} ${tr.origin} ${tr.destination}`.toLowerCase(),
        onSelect: () => navigate(`/trips/${tr.id}`),
      })),
    [navigate],
  )
  const clientItems = useMemo(
    () =>
      clients.map((c) => ({
        id: c.id,
        label: `${c.firstName} ${c.lastName}`,
        hint: c.email,
        value: `client ${c.firstName} ${c.lastName} ${c.email}`.toLowerCase(),
        onSelect: () => navigate(`/clients/${c.id}`),
      })),
    [navigate],
  )
  const hotelItems = useMemo(
    () =>
      hotels.map((h) => ({
        id: h.id,
        label: h.name,
        hint: `${h.city}, ${h.country}`,
        value: `hotel ${h.name} ${h.city} ${h.country}`.toLowerCase(),
        onSelect: () => navigate(`/hotels/${h.id}`),
      })),
    [navigate],
  )
  const managerItems = useMemo(
    () =>
      managers.map((m) => ({
        id: m.id,
        label: m.name,
        hint: m.email,
        value: `manager ${m.name} ${m.email}`.toLowerCase(),
        onSelect: () => navigate(`/managers/${m.id}`),
      })),
    [navigate],
  )

  const go = (path: string) => () => navigate(path)

  const runAction = (fn: () => void) => {
    setOpen(false)
    fn()
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t("palette.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("palette.empty")}</CommandEmpty>

        <CommandGroup heading={t("palette.groups.actions")}>
          <CommandItem value="action dashboard" onSelect={() => runAction(go("/"))}>
            <LayoutDashboard />
            <span>{t("palette.actions.goDashboard")}</span>
          </CommandItem>
          <CommandItem value="action calendar" onSelect={() => runAction(go("/calendar"))}>
            <CalendarDays />
            <span>{t("palette.actions.goCalendar")}</span>
          </CommandItem>
          <CommandItem value="action finance" onSelect={() => runAction(go("/finance"))}>
            <Wallet />
            <span>{t("palette.actions.goFinance")}</span>
          </CommandItem>
          <CommandItem
            value="action new-booking"
            onSelect={() => runAction(go("/bookings/new"))}
          >
            <PlusCircle />
            <span>{t("palette.actions.newBooking")}</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />

        <CommandGroup heading={t("palette.groups.trips")}>
          {tripItems.map((it) => (
            <CommandItem key={it.id} value={it.value} onSelect={() => runAction(it.onSelect)}>
              <Bus />
              <span>{it.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">{it.hint}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />

        <CommandGroup heading={t("palette.groups.clients")}>
          {clientItems.map((it) => (
            <CommandItem key={it.id} value={it.value} onSelect={() => runAction(it.onSelect)}>
              <Users />
              <span>{it.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">{it.hint}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />

        <CommandGroup heading={t("palette.groups.hotels")}>
          {hotelItems.map((it) => (
            <CommandItem key={it.id} value={it.value} onSelect={() => runAction(it.onSelect)}>
              <Hotel />
              <span>{it.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">{it.hint}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />

        <CommandGroup heading={t("palette.groups.managers")}>
          {managerItems.map((it) => (
            <CommandItem key={it.id} value={it.value} onSelect={() => runAction(it.onSelect)}>
              <UserRound />
              <span>{it.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">{it.hint}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
