import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useBookingsByTrip } from "@/hooks/queries/use-bookings"
import { layoutFor } from "@/lib/bus-layouts"
import type { BusType, Cell, SeatStatus } from "@/types"

import { SeatCellView } from "./seat-cell"
import { SeatLegend } from "./seat-legend"

interface SeatMapProps {
  busType: BusType
  tripId: string
  onSelect?: (seatNumber: number) => void
  selected?: number[]
}

type TripBooking = NonNullable<ReturnType<typeof useBookingsByTrip>["data"]>[number]

function applyBookings(
  deck: Cell[][],
  tripBookings: TripBooking[],
  selected: Set<number>,
): { deck: Cell[][]; totals: Record<SeatStatus, number> } {
  const seatIndex = new Map<
    number,
    { booking: TripBooking; passenger: TripBooking["passengers"][number] }
  >()
  for (const b of tripBookings) {
    for (const p of b.passengers) {
      seatIndex.set(p.seatNumber, { booking: b, passenger: p })
    }
  }
  const totals: Record<SeatStatus, number> = {
    free: 0,
    selected: 0,
    reserved: 0,
    sold: 0,
    blocked: 0,
  }

  const next = deck.map((row) =>
    row.map((cell) => {
      if (!cell || cell.type !== "seat") return cell
      const hit = seatIndex.get(cell.number)
      let status: SeatStatus = "free"
      let passengerName: string | undefined
      if (hit) {
        status = hit.booking.status === "paid" ? "sold" : "reserved"
        passengerName = `${hit.passenger.firstName} ${hit.passenger.lastName}`
      }
      if (selected.has(cell.number) && status === "free") status = "selected"
      totals[status]++
      return { ...cell, status, passengerName }
    }),
  )
  return { deck: next, totals }
}

export function SeatMap({ busType, tripId, onSelect, selected }: SeatMapProps) {
  const { t } = useTranslation()
  const selectedSet = useMemo(() => new Set(selected ?? []), [selected])
  const layout = useMemo(() => layoutFor(busType), [busType])
  const { data: tripBookings = [] } = useBookingsByTrip(tripId)

  const processed = useMemo(
    () => layout.decks.map((d) => applyBookings(d, tripBookings, selectedSet)),
    [layout, tripBookings, selectedSet],
  )

  const renderDeck = (deck: Cell[][]) => (
    <div
      role="grid"
      aria-label={`Bus seat map ${busType} seats`}
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${deck[0]?.length ?? 5}, minmax(0, 1fr))` }}
    >
      {deck.flatMap((row, rIdx) =>
        row.map((cell, cIdx) => (
          <div key={`${rIdx}-${cIdx}`} role="gridcell">
            <SeatCellView cell={cell} onSelect={onSelect} />
          </div>
        )),
      )}
    </div>
  )

  const totals = processed.reduce<Record<SeatStatus, number>>(
    (acc, { totals: t }) => ({
      free: acc.free + t.free,
      selected: acc.selected + t.selected,
      reserved: acc.reserved + t.reserved,
      sold: acc.sold + t.sold,
      blocked: acc.blocked + t.blocked,
    }),
    { free: 0, selected: 0, reserved: 0, sold: 0, blocked: 0 },
  )

  return (
    <div className="space-y-4">
      <SeatLegend />
      {busType === "55" ? (
        <div className="max-w-xs">{renderDeck(processed[0].deck)}</div>
      ) : (
        <Tabs defaultValue="upper" className="max-w-md">
          <TabsList>
            <TabsTrigger value="upper">Upper deck</TabsTrigger>
            <TabsTrigger value="lower">Lower deck</TabsTrigger>
          </TabsList>
          <TabsContent value="upper">{renderDeck(processed[0].deck)}</TabsContent>
          <TabsContent value="lower">{renderDeck(processed[1].deck)}</TabsContent>
        </Tabs>
      )}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>
          {t("seat.free")}: <span className="tabular-nums">{totals.free}</span>
        </span>
        <span>
          {t("seat.reserved")}: <span className="tabular-nums">{totals.reserved}</span>
        </span>
        <span>
          {t("seat.sold")}: <span className="tabular-nums">{totals.sold}</span>
        </span>
      </div>
    </div>
  )
}
