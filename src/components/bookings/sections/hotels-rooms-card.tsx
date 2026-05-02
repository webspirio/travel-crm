import type { TFunction } from "i18next"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Booking, Hotel, Passenger, RoomType } from "@/types"

interface Props {
  booking: Booking
  hotels: Hotel[]
  t: TFunction<"booking">
  tc: TFunction
}

interface Group {
  /** stable composite key for React */
  key: string
  hotelId: string | null
  roomType: RoomType | null
  passengers: Passenger[]
}

/**
 * Hotels & Rooms — passengers grouped by (hotelId, roomType). Lap-infants
 * and other passengers without a hotel are collected into a "No hotel" tail
 * group so nobody is silently dropped.
 */
export function HotelsRoomsCard({ booking, hotels, t, tc }: Props) {
  const hotelById = new Map(hotels.map((h) => [h.id, h]))

  // Stable, insertion-ordered grouping keyed by composite.
  const groupMap = new Map<string, Group>()
  for (const p of booking.passengers) {
    const hotelId = p.hotelId || null
    const roomType = p.roomType ?? null
    const key = `${hotelId ?? "—"}::${roomType ?? "—"}`
    let g = groupMap.get(key)
    if (!g) {
      g = { key, hotelId, roomType, passengers: [] }
      groupMap.set(key, g)
    }
    g.passengers.push(p)
  }

  // Re-order so "no hotel" groups always come last (stable within partitions).
  const groups = [...groupMap.values()]
  const withHotel = groups.filter((g) => !!g.hotelId)
  const noHotel = groups.filter((g) => !g.hotelId)
  const ordered = [...withHotel, ...noHotel]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("detail.sections.hotelsRooms")}</CardTitle>
      </CardHeader>
      <CardContent>
        {ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <div className="space-y-4 text-sm">
            {ordered.map((g) => {
              const hotel = g.hotelId ? hotelById.get(g.hotelId) : undefined
              const hotelName = hotel?.name ?? t("detail.hotelsRooms.noHotel")
              const roomLabel = g.roomType ? tc(`room.${g.roomType}`) : "—"
              return (
                <div key={g.key} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-medium">{hotelName}</p>
                      {g.roomType && (
                        <p className="text-xs text-muted-foreground">{roomLabel}</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {g.passengers.length} {t("detail.hotelsRooms.passengers")}
                    </p>
                  </div>
                  <ul className="mt-2 space-y-0.5">
                    {g.passengers.map((p) => (
                      <li key={p.id} className="text-muted-foreground">
                        {p.firstName} {p.lastName}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
