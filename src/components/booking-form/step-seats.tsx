import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { SeatMap } from "@/components/bus/seat-map"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useOccupiedSeats, useTripById } from "@/hooks/queries/use-trips"
import { useBookingsByTrip } from "@/hooks/queries/use-bookings"
import { layoutFor } from "@/lib/bus-layouts"
import { isOccupying } from "@/lib/booking-status"
import { cn } from "@/lib/utils"
import type { PassengerDraft } from "@/stores/booking-store"
import { useBookingDraft } from "@/lib/booking-draft-context"

// ─── Colour palette for passenger pills ───────────────────────────────────────

const PILL_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-amber-500",
  "bg-indigo-500",
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(p: PassengerDraft): string {
  const f = p.firstName.trim()
  const l = p.lastName.trim()
  if (!f && !l) return "?"
  if (!l) return (f[0] ?? "?").toUpperCase()
  if (!f) return (l[0] ?? "?").toUpperCase()
  return `${f[0]}${l[0]}`.toUpperCase()
}

function getDisplayName(p: PassengerDraft, fallback: string): string {
  const name = `${p.firstName} ${p.lastName}`.trim()
  return name || fallback
}

/** Returns true when the passenger needs a physical seat (not a lap-infant). */
function isSeatable(p: PassengerDraft): boolean {
  return !(p.kind === "infant" && p.seatNumber === null)
}

// ─── Swap confirm dialog ───────────────────────────────────────────────────────

interface SwapDialogProps {
  open: boolean
  seatNumber: number
  ownerName: string
  onConfirm: () => void
  onCancel: () => void
}

function SwapConfirmDialog({ open, seatNumber, ownerName, onConfirm, onCancel }: SwapDialogProps) {
  const { t } = useTranslation("booking")
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("seats.swapConfirmTitle")}</DialogTitle>
          <DialogDescription>
            {t("seats.swapConfirmBody", { seat: seatNumber, name: ownerName })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" onClick={onCancel} />}>
            {t("seats.swapConfirmNo")}
          </DialogClose>
          <Button onClick={onConfirm}>{t("seats.swapConfirmYes")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StepSeats() {
  const { t } = useTranslation("booking")
  const passengers = useBookingDraft((s) => s.passengers)
  const updatePassenger = useBookingDraft((s) => s.updatePassenger)
  const tripId = useBookingDraft((s) => s.tripId)
  const { data: trip } = useTripById(tripId ?? undefined)

  // ── Seatable vs lap-infant split ──────────────────────────────────────────
  const seatable = useMemo(() => passengers.filter(isSeatable), [passengers])
  const lapInfants = useMemo(() => passengers.filter((p) => !isSeatable(p)), [passengers])

  // ── Active pill state — clamped to valid index range ─────────────────────
  const [rawActiveIdx, setActiveIdx] = useState(0)
  // Derive a clamped index without an effect to avoid cascading renders
  const activeIdx = Math.min(rawActiveIdx, Math.max(0, seatable.length - 1))
  const activePassenger = seatable[activeIdx] ?? null

  // ── Occupied seat data (cross-booking) ────────────────────────────────────
  const { data: occupied = [] } = useOccupiedSeats(tripId ?? undefined)
  const { data: tripBookings = [] } = useBookingsByTrip(tripId ?? "")

  // Build cross-booking occupied set (seats held by OTHER confirmed bookings)
  const crossOccupied = useMemo(() => {
    const s = new Set<number>()
    for (const b of tripBookings) {
      if (!isOccupying(b.status)) continue
      for (const p of b.passengers) {
        if (p.seatNumber !== null) s.add(p.seatNumber)
      }
    }
    // Also include RPC hints for seats from bookings not visible in our query
    for (const o of occupied) s.add(o.seatNumber)
    return s
  }, [tripBookings, occupied])

  // Draft-assigned seats in THIS booking wizard (seatNumber → localId)
  const draftAssigned = useMemo(() => {
    const m = new Map<number, string>()
    for (const p of seatable) {
      if (p.seatNumber !== null) m.set(p.seatNumber, p.localId)
    }
    return m
  }, [seatable])

  // ── Colour map: localId → tailwind colour class ───────────────────────────
  const colorMap = useMemo(() => {
    const m = new Map<string, string>()
    seatable.forEach((p, i) => {
      m.set(p.localId, PILL_COLORS[i % PILL_COLORS.length])
    })
    return m
  }, [seatable])

  // ── assignedTo map for SeatMap: seatNumber → initials ────────────────────
  const assignedToMap = useMemo(() => {
    const m = new Map<number, string>()
    for (const p of seatable) {
      if (p.seatNumber !== null) {
        m.set(p.seatNumber, getInitials(p))
      }
    }
    return m
  }, [seatable])

  // ── Selected seats array (all draft-assigned seats) ───────────────────────
  const selectedSeats = useMemo(
    () =>
      seatable
        .filter((p) => p.seatNumber !== null)
        .map((p) => p.seatNumber as number),
    [seatable],
  )

  // ── Swap dialog state ─────────────────────────────────────────────────────
  const [swapPending, setSwapPending] = useState<{
    seatNumber: number
    ownerLocalId: string
    ownerName: string
  } | null>(null)

  // ── Seat-together handler (defined before the keyboard effect that uses it) ─
  const handleSeatTogether = useCallback(() => {
    if (!trip) return
    const n = seatable.length
    if (n === 0) return

    const layout = layoutFor(trip.busType)
    for (const deck of layout.decks) {
      // Collect free-seat numbers in row order (neither cross-occupied nor draft)
      const freeInOrder: number[] = []
      for (const row of deck) {
        for (const cell of row) {
          if (cell?.type === "seat" && !crossOccupied.has(cell.number) && !draftAssigned.has(cell.number)) {
            freeInOrder.push(cell.number)
          }
        }
      }
      // Scan for a contiguous run of n entries in the layout order
      if (freeInOrder.length >= n) {
        const block = freeInOrder.slice(0, n)
        block.forEach((seatNum, idx) => {
          const p = seatable[idx]
          if (p) updatePassenger(p.localId, { seatNumber: seatNum })
        })
        return
      }
    }
    toast.error(t("seats.noBlockFound", { n }))
  }, [crossOccupied, draftAssigned, seatable, t, trip, updatePassenger])

  // ── Auto-assign handler ───────────────────────────────────────────────────
  const handleAutoAssign = useCallback(() => {
    if (!trip) return
    const layout = layoutFor(trip.busType)
    const allSeats: number[] = []
    for (const deck of layout.decks) {
      for (const row of deck) {
        for (const cell of row) {
          if (cell?.type === "seat") allSeats.push(cell.number)
        }
      }
    }
    const unassigned = seatable.filter((p) => p.seatNumber === null)
    let assigned = 0
    for (const seatNum of allSeats) {
      if (unassigned[assigned] === undefined) break
      if (crossOccupied.has(seatNum)) continue
      if (draftAssigned.has(seatNum)) continue
      updatePassenger(unassigned[assigned].localId, { seatNumber: seatNum })
      assigned++
    }
  }, [crossOccupied, draftAssigned, seatable, trip, updatePassenger])

  // ── Global keyboard shortcut: Cmd+Shift+S → Seat together ─────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "S") {
        e.preventDefault()
        handleSeatTogether()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handleSeatTogether])

  // ── Seat click handler ────────────────────────────────────────────────────
  const handleSeatSelect = useCallback(
    (seatNumber: number) => {
      if (!activePassenger) return

      const draftOwnerLocalId = draftAssigned.get(seatNumber)

      // 1. Seat occupied by a confirmed booking (not a draft seat) → block
      if (crossOccupied.has(seatNumber) && !draftOwnerLocalId) {
        toast.error(t("seats.soldToast"))
        return
      }

      // 2. Active passenger clicks their own seat → unassign
      if (activePassenger.seatNumber === seatNumber) {
        updatePassenger(activePassenger.localId, { seatNumber: null })
        return
      }

      // 3. Seat belongs to another draft passenger → open swap dialog
      if (draftOwnerLocalId && draftOwnerLocalId !== activePassenger.localId) {
        const owner = seatable.find((p) => p.localId === draftOwnerLocalId)
        if (owner) {
          setSwapPending({
            seatNumber,
            ownerLocalId: draftOwnerLocalId,
            ownerName: getDisplayName(owner, t("travelers.namePlaceholder")),
          })
          return
        }
      }

      // 4. Free seat → assign to active passenger
      updatePassenger(activePassenger.localId, { seatNumber })
      // Advance to next unassigned seatable passenger automatically
      const nextUnassigned = seatable.findIndex(
        (p, i) => i !== activeIdx && p.seatNumber === null,
      )
      if (nextUnassigned !== -1) setActiveIdx(nextUnassigned)
    },
    [activePassenger, activeIdx, draftAssigned, crossOccupied, seatable, t, updatePassenger],
  )

  const confirmSwap = useCallback(() => {
    if (!swapPending || !activePassenger) return
    const { seatNumber, ownerLocalId } = swapPending
    // Give the owner the active passenger's current seat (or null)
    updatePassenger(ownerLocalId, { seatNumber: activePassenger.seatNumber })
    updatePassenger(activePassenger.localId, { seatNumber })
    setSwapPending(null)
  }, [swapPending, activePassenger, updatePassenger])

  // ── Keyboard navigation on pill row ──────────────────────────────────────
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handlePillKeyDown = useCallback(
    (e: React.KeyboardEvent, idx: number) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault()
        const next =
          e.key === "ArrowLeft"
            ? Math.max(0, idx - 1)
            : Math.min(seatable.length - 1, idx + 1)
        setActiveIdx(next)
        pillRefs.current[next]?.focus()
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        setActiveIdx(idx)
      }
    },
    [seatable.length],
  )

  // ── Badge counts ──────────────────────────────────────────────────────────
  const waitingCount = seatable.filter((p) => p.seatNumber === null).length
  const seatedCount = seatable.filter((p) => p.seatNumber !== null).length

  // ── Early return if no trip selected ─────────────────────────────────────
  if (!trip) {
    return <p className="text-muted-foreground">{t("validation.pickTrip")}</p>
  }

  return (
    <div className="space-y-5">
      {/* Header row: status badges + action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {waitingCount > 0 && (
            <Badge variant="secondary">
              {t("seats.waiting", { count: waitingCount })}
            </Badge>
          )}
          {seatedCount > 0 && (
            <Badge variant="default">
              {t("seats.seated", { count: seatedCount })}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAutoAssign} type="button">
            {t("seats.autoAssign")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeatTogether}
            type="button"
            title={t("seats.helpHint")}
          >
            {t("seats.seatTogether")}
          </Button>
        </div>
      </div>

      {/* Passenger pill row (roving tabindex) */}
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("seats.title")}>
        {seatable.map((p, idx) => {
          const isActive = idx === activeIdx
          const color = colorMap.get(p.localId) ?? "bg-slate-500"
          const name = getDisplayName(p, t("travelers.namePlaceholder"))
          return (
            <button
              key={p.localId}
              ref={(el) => { pillRefs.current[idx] = el }}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={
                isActive
                  ? t("seats.activePassenger", { name })
                  : name
              }
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveIdx(idx)}
              onKeyDown={(e) => handlePillKeyDown(e, idx)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-medium transition-all",
                isActive
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                  : "border-transparent bg-muted hover:border-border",
              )}
            >
              {/* Colour dot with initials */}
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white",
                  color,
                )}
                aria-hidden
              >
                {getInitials(p)}
              </span>
              <span className="max-w-[10rem] truncate">{name}</span>
              {p.seatNumber !== null ? (
                <span className="ml-0.5 rounded bg-primary/15 px-1 text-xs tabular-nums text-primary">
                  #{p.seatNumber}
                </span>
              ) : (
                <span className="ml-0.5 text-xs text-muted-foreground">—</span>
              )}
            </button>
          )
        })}

        {/* Lap-infant pills (non-selectable) */}
        {lapInfants.map((p) => {
          const name = getDisplayName(p, t("travelers.namePlaceholder"))
          return (
            <span
              key={p.localId}
              className="flex items-center gap-1.5 rounded-full border-2 border-dashed border-muted px-3 py-1 text-sm text-muted-foreground opacity-60"
              aria-label={`${name} ${t("seats.lapInfant")}`}
            >
              <span
                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-bold"
                aria-hidden
              >
                {getInitials(p)}
              </span>
              <span className="max-w-[8rem] truncate">{name}</span>
              <span className="text-xs">{t("seats.lapInfant")}</span>
            </span>
          )
        })}
      </div>

      {/* Active passenger hint */}
      {activePassenger && (
        <p className="text-xs text-muted-foreground">
          {t("seats.activePassenger", {
            name: getDisplayName(activePassenger, t("travelers.namePlaceholder")),
          })}
          {" · "}
          <span className="italic">{t("seats.helpHint")}</span>
        </p>
      )}

      {/* Seat map */}
      <SeatMap
        busType={trip.busType}
        tripId={trip.id}
        selected={selectedSeats}
        assignedTo={assignedToMap}
        onSelect={handleSeatSelect}
      />

      {/* Swap confirm dialog */}
      <SwapConfirmDialog
        open={swapPending !== null}
        seatNumber={swapPending?.seatNumber ?? 0}
        ownerName={swapPending?.ownerName ?? ""}
        onConfirm={confirmSwap}
        onCancel={() => setSwapPending(null)}
      />
    </div>
  )
}
