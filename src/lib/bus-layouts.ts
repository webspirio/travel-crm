// Bus seat layouts are UI configuration — pure deck/row geometry plus
// non-seat cells (driver, door, toilet, stairs, kitchen). They are NOT
// DB data: the database only stores `bus_type` (enum) and `capacity`
// (smallint) on `trips`; the actual cell layout is rendered from this
// file at the bus type's matching factory function.
//
// Moved verbatim from src/data/seats.ts during Phase 2 (the src/data
// directory is for mock data only, deleted at the end of PR 3).

import type { BusLayout, Cell, SeatCell, SpecialCell } from "@/types"

const special = (kind: SpecialCell["kind"]): SpecialCell => ({ type: "special", kind })

function makeSeat(n: number): SeatCell {
  return { type: "seat", id: `s-${n}`, number: n, status: "free" }
}

export function generate55SeatLayout(): BusLayout {
  const deck: Cell[][] = []
  deck.push([special("driver"), null, null, null, special("door")])

  let seatNum = 1
  for (let row = 0; row < 13; row++) {
    deck.push([makeSeat(seatNum++), makeSeat(seatNum++), null, makeSeat(seatNum++), makeSeat(seatNum++)])
  }
  deck.push([makeSeat(seatNum++), makeSeat(seatNum++), makeSeat(seatNum++), null, special("toilet")])

  return { busType: "55", decks: [deck] }
}

export function generate79SeatLayout(): BusLayout {
  const upper: Cell[][] = []
  let seatNum = 1
  for (let row = 0; row < 15; row++) {
    upper.push([makeSeat(seatNum++), makeSeat(seatNum++), null, makeSeat(seatNum++), makeSeat(seatNum++)])
  }

  const lower: Cell[][] = []
  lower.push([special("driver"), null, null, null, special("door")])
  lower.push([special("stairs"), null, null, null, special("kitchen")])
  lower.push([makeSeat(seatNum++), makeSeat(seatNum++), null, makeSeat(seatNum++), makeSeat(seatNum++)])
  lower.push([makeSeat(seatNum++), makeSeat(seatNum++), null, makeSeat(seatNum++), makeSeat(seatNum++)])
  for (let row = 0; row < 4; row++) {
    lower.push([makeSeat(seatNum++), makeSeat(seatNum++), null, makeSeat(seatNum++), makeSeat(seatNum++)])
  }
  lower.push([makeSeat(seatNum++), makeSeat(seatNum++), makeSeat(seatNum++), null, special("toilet")])

  return { busType: "79", decks: [upper, lower] }
}

export function layoutFor(busType: "55" | "79"): BusLayout {
  return busType === "55" ? generate55SeatLayout() : generate79SeatLayout()
}
