/**
 * StepRooms — multi-room hotel assignment per passenger (Task 8).
 *
 * Each booking may have 1–N RoomDrafts; passengers are grouped into rooms via
 * roomGroupId. Lap-infants (kind="infant", seatNumber=null) are shown but not
 * counted toward room capacity and carry no hotel charge.
 */

import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useHotelBlocks } from "@/hooks/queries/use-hotel-blocks"
import { useHotels } from "@/hooks/queries/use-hotels"
import { useTripById } from "@/hooks/queries/use-trips"
import type { PassengerDraft, RoomDraft } from "@/stores/booking-store"
import { useBookingDraft } from "@/lib/booking-draft-context"
import type { RoomType } from "@/types"

// ─── Constants ─────────────────────────────────────────────────────────────────

const ROOM_TYPES: RoomType[] = ["single", "double", "triple", "family"]

/** Max non-lap occupants per room type. */
const ROOM_CAPACITY: Record<RoomType, number> = {
  single: 1,
  double: 2,
  triple: 3,
  family: 4,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** A passenger is a "lap infant" if kind === "infant" and has no seat. */
function isLapInfant(p: PassengerDraft): boolean {
  return p.kind === "infant" && p.seatNumber === null
}

/** Display name, falling back to placeholder. */
function passengerName(p: PassengerDraft, fallback: string): string {
  const n = `${p.firstName} ${p.lastName}`.trim()
  return n || fallback
}

/** Count non-lap passengers assigned to a room. */
function countOccupants(passengers: PassengerDraft[], roomLocalId: string): number {
  return passengers.filter(
    (p) => p.roomGroupId === roomLocalId && !isLapInfant(p),
  ).length
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface RoomCardProps {
  room: RoomDraft
  index: number
  passengers: PassengerDraft[]
  nights: number
  /** Allotment remaining for (hotelId, roomType) — undefined = unknown / no data */
  allotmentRemaining: Map<string, number>
  /** When undefined, the per-room remove button is hidden (edit mode). */
  onRemove?: (localId: string) => void
  onAssign: (passengerLocalId: string, roomLocalId: string | null) => void
  onChangeType: (localId: string, roomType: RoomType) => void
}

function RoomCard({
  room,
  index,
  passengers,
  nights,
  allotmentRemaining,
  onRemove,
  onAssign,
  onChangeType,
}: RoomCardProps) {
  const { t } = useTranslation("booking")

  const capacity = ROOM_CAPACITY[room.roomType]
  const occupants = countOccupants(passengers, room.localId)
  const roomPassengers = passengers.filter((p) => p.roomGroupId === room.localId)
  const costPerPax =
    occupants > 0 ? Math.round((room.pricePerNight * nights) / occupants) : 0

  function handleCheckboxChange(p: PassengerDraft, checked: boolean) {
    if (checked) {
      onAssign(p.localId, room.localId)
    } else {
      onAssign(p.localId, null)
    }
  }

  function handleRemoveRoom() {
    if (!onRemove) return
    const hasAssigned = roomPassengers.length > 0
    if (hasAssigned) {
      if (!window.confirm(t("rooms.confirmRemoveRoom"))) return
    }
    onRemove(room.localId)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">
            {t("rooms.roomLabel", { n: index + 1 })}
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Room type selector */}
            <Select
              value={room.roomType}
              onValueChange={(v) => onChangeType(room.localId, v as RoomType)}
            >
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROOM_TYPES.map((rt) => {
                  const key = `${room.hotelId}:${rt}`
                  const remaining = allotmentRemaining.get(key)
                  const soldOut = remaining !== undefined && remaining <= 0
                  return (
                    <SelectItem key={rt} value={rt} disabled={soldOut}>
                      {t(`rooms.roomType.${rt}`)}
                      {soldOut && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({t("rooms.familySoldOut")})
                        </span>
                      )}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            {/* Price badge */}
            {room.pricePerNight > 0 && (
              <Badge variant="secondary" className="text-xs tabular-nums">
                {t("rooms.pricePerNight", { amount: room.pricePerNight })}
              </Badge>
            )}

            {onRemove && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleRemoveRoom}
              >
                {t("rooms.removeRoom")}
              </Button>
            )}
          </div>
        </div>

        {/* Per-pax cost info */}
        {nights > 0 && room.pricePerNight > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("rooms.priceNights", { nights, price: room.pricePerNight })}
            {occupants > 0 && (
              <> · {t("rooms.totalPerPax", { amount: costPerPax })}</>
            )}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-2">
        {passengers.map((p) => {
          const lap = isLapInfant(p)
          const inThisRoom = p.roomGroupId === room.localId
          const inOtherRoom = p.roomGroupId !== null && p.roomGroupId !== room.localId
          // At capacity for non-lap and not already in this room
          const atCapacity = !lap && occupants >= capacity && !inThisRoom
          const disabled = inOtherRoom || atCapacity

          return (
            <div key={p.localId} className="flex items-center gap-2">
              <Checkbox
                id={`room-${room.localId}-pax-${p.localId}`}
                checked={inThisRoom}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  handleCheckboxChange(p, checked === true)
                }
              />
              <Label
                htmlFor={`room-${room.localId}-pax-${p.localId}`}
                className="cursor-pointer font-normal"
              >
                {passengerName(p, "—")}
                {lap && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    {t("rooms.lapInfantTag")}
                  </span>
                )}
                {inOtherRoom && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({t("rooms.assignedElsewhere", { defaultValue: "other room" })})
                  </span>
                )}
              </Label>
            </div>
          )
        })}

        {passengers.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("rooms.noPassengers", { defaultValue: "No passengers yet" })}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function StepRooms({ editMode = false }: { editMode?: boolean } = {}) {
  const { t } = useTranslation("booking")

  // Store slices
  const tripId = useBookingDraft((s) => s.tripId)
  const passengers = useBookingDraft((s) => s.passengers)
  const rooms = useBookingDraft((s) => s.rooms)
  const noHotel = useBookingDraft((s) => s.noHotel)
  const addRoom = useBookingDraft((s) => s.addRoom)
  const removeRoom = useBookingDraft((s) => s.removeRoom)
  const assignToRoom = useBookingDraft((s) => s.assignToRoom)
  const updatePassenger = useBookingDraft((s) => s.updatePassenger)
  const update = useBookingDraft((s) => s.update)

  // Data fetches
  const { data: trip } = useTripById(tripId ?? undefined)
  const { data: allHotels = [] } = useHotels()
  const { data: hotelBlocks = [] } = useHotelBlocks(tripId ?? undefined)

  // Derive hotels for this trip
  const tripHotels = useMemo(
    () => allHotels.filter((h) => trip?.hotelIds.includes(h.id)),
    [allHotels, trip],
  )

  // Selected hotel (use first room's hotelId, or first tripHotel as default)
  const selectedHotelId = rooms[0]?.hotelId ?? null
  const selectedHotel = allHotels.find((h) => h.id === selectedHotelId) ?? null

  // Trip duration in nights
  const nights = useMemo(() => {
    if (!trip) return 0
    const ms = trip.returnDate.getTime() - trip.departureDate.getTime()
    return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)))
  }, [trip])

  // Build allotment-remaining map: key = "hotelId:roomType" → remaining qty
  const allotmentRemaining = useMemo(() => {
    const map = new Map<string, number>()
    for (const block of hotelBlocks) {
      const key = `${block.hotel_id}:${block.room_type}`
      map.set(key, block.qty_total - block.qty_used)
    }
    return map
  }, [hotelBlocks])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  /** Switch the hotel for all rooms. Creates a first room if none exist. */
  function handleSelectHotel(hotelId: string) {
    const hotel = allHotels.find((h) => h.id === hotelId)
    if (!hotel) return
    const defaultPpn = hotel.rooms.double.pricePerNight

    if (rooms.length === 0) {
      // Auto-create a first double room
      addRoom(hotelId, "double", defaultPpn)
    } else {
      // Update all existing rooms to use the new hotel
      update({
        rooms: rooms.map((r) => ({
          ...r,
          hotelId,
          pricePerNight: hotel.rooms[r.roomType]?.pricePerNight ?? defaultPpn,
        })),
      })
    }
    // Clear noHotel if it was on
    if (noHotel) update({ noHotel: false })
  }

  function handleAddRoom() {
    const hotelId =
      selectedHotelId ??
      (tripHotels.length > 0 ? tripHotels[0].id : null)
    if (!hotelId) return
    const hotel = allHotels.find((h) => h.id === hotelId)
    const ppn = hotel?.rooms.double.pricePerNight ?? 0
    addRoom(hotelId, "double", ppn)
  }

  function handleChangeRoomType(localId: string, roomType: RoomType) {
    const hotel = selectedHotel
    const ppn = hotel?.rooms[roomType]?.pricePerNight ?? 0
    update({
      rooms: rooms.map((r) =>
        r.localId === localId ? { ...r, roomType, pricePerNight: ppn } : r,
      ),
    })
    // Re-assign passengers in this room so their roomType is updated
    const affected = passengers.filter((p) => p.roomGroupId === localId)
    for (const p of affected) {
      updatePassenger(p.localId, { roomType, hotelId: rooms.find((r) => r.localId === localId)?.hotelId ?? p.hotelId })
    }
  }

  function handleRemoveRoom(localId: string) {
    // Unassign all passengers in this room
    const affected = passengers.filter((p) => p.roomGroupId === localId)
    for (const p of affected) {
      assignToRoom(p.localId, null)
    }
    removeRoom(localId)
  }

  function handleSkipAll() {
    // Clear all room assignments and mark noHotel
    for (const p of passengers) {
      updatePassenger(p.localId, { hotelId: null, roomType: null, roomGroupId: null })
    }
    update({ noHotel: true, rooms: [] })
  }

  function handleUndoSkipAll() {
    update({ noHotel: false })
  }

  function handleDeclineHotel(passengerId: string) {
    // Per-passenger opt-out: null all hotel fields + unassign from any room
    assignToRoom(passengerId, null)
    updatePassenger(passengerId, { hotelId: null, roomType: null, roomGroupId: null })
  }

  // ── Unassigned passengers panel ──────────────────────────────────────────────

  // All passengers shown in unassigned panel = those without a room
  const notInRoom = passengers.filter((p) => p.roomGroupId === null)

  // ── Guard: no trip selected ──────────────────────────────────────────────────

  if (!trip) {
    return (
      <p className="text-muted-foreground">{t("validation.pickTrip")}</p>
    )
  }

  // ── noHotel confirmed view ───────────────────────────────────────────────────

  if (noHotel) {
    return (
      <div className="space-y-3 rounded-md border border-dashed p-4">
        <p className="text-sm text-muted-foreground">
          {t("rooms.noHotelConfirmed")}
        </p>
        <Button variant="outline" size="sm" onClick={handleUndoSkipAll}>
          {t("rooms.undoSkip")}
        </Button>
      </div>
    )
  }

  // ── No hotels associated with this trip ─────────────────────────────────────

  if (tripHotels.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("rooms.tripHasNoHotel")}</p>
        {!editMode && (
          <Button variant="outline" size="sm" onClick={handleSkipAll}>
            {t("rooms.skipHotel")}
          </Button>
        )}
      </div>
    )
  }

  // ── Main layout ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Hotel selector */}
      <div className="space-y-2">
        <Label>{t("rooms.hotelLabel")}</Label>
        <div className="flex flex-wrap gap-2">
          {tripHotels.map((h) => {
            const selected = h.id === selectedHotelId
            return (
              <Button
                key={h.id}
                type="button"
                variant={selected ? "default" : "outline"}
                size="sm"
                onClick={() => handleSelectHotel(h.id)}
              >
                {h.name}
                <span className="ml-1 text-xs opacity-70">{"★".repeat(h.stars)}</span>
              </Button>
            )
          })}
        </div>
      </div>

      {selectedHotelId && (
        <>
          {/* Room cards */}
          {rooms.length > 0 && (
            <div className="space-y-4">
              {rooms.map((room, idx) => (
                <RoomCard
                  key={room.localId}
                  room={room}
                  index={idx}
                  passengers={passengers}
                  nights={nights}
                  allotmentRemaining={allotmentRemaining}
                  onRemove={editMode ? undefined : handleRemoveRoom}
                  onAssign={assignToRoom}
                  onChangeType={handleChangeRoomType}
                />
              ))}
            </div>
          )}

          {/* Add room — hidden in edit mode (T10: add/remove out of scope v1) */}
          {!editMode && (
            <Button variant="outline" size="sm" onClick={handleAddRoom}>
              {t("rooms.addRoom")}
            </Button>
          )}

          {/* Unassigned panel */}
          {notInRoom.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("rooms.unassigned")}</p>
                <div className="space-y-1">
                  {notInRoom.map((p) => {
                    const lap = isLapInfant(p)
                    const hasDeclined =
                      p.roomGroupId === null && p.hotelId === null && !lap
                    return (
                      <div
                        key={p.localId}
                        className="flex items-center justify-between gap-2 rounded-sm px-2 py-1 text-sm hover:bg-accent/30"
                      >
                        <span>
                          {passengerName(p, "—")}
                          {lap && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              {t("rooms.lapInfantTag")}
                            </span>
                          )}
                          {hasDeclined && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {t("rooms.declineHotel")}
                            </Badge>
                          )}
                        </span>
                        {!lap && !hasDeclined && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground"
                            onClick={() => handleDeclineHotel(p.localId)}
                          >
                            {t("rooms.declineHotel")}
                          </Button>
                        )}
                        {hasDeclined && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() =>
                              updatePassenger(p.localId, {
                                hotelId: selectedHotelId,
                              })
                            }
                          >
                            {t("rooms.undoSkip")}
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Skip hotel for everyone — hidden in edit mode (would wipe assignments) */}
      {!editMode && (
        <>
          <Separator />
          <Button variant="ghost" size="sm" onClick={handleSkipAll}>
            {t("rooms.skipAll")}
          </Button>
        </>
      )}
    </div>
  )
}
