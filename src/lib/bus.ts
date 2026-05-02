// DB ↔ UI translation for the two enums whose DB encoding diverges from
// the frontend representation:
//   - bus_type:    'bus_55' / 'bus_79'  ↔  '55' / '79'
//   - trip_status: 'in_progress'         ↔  'in-progress'
// (other trip_status values are identical in both directions.)

import type { BusType, TripStatus } from "@/types"
import type { Database } from "@/types/database"

type DbBusType = Database["public"]["Enums"]["bus_type"]
type DbTripStatus = Database["public"]["Enums"]["trip_status"]

const BUS_TYPE_DB_TO_UI: Record<DbBusType, BusType> = {
  bus_55: "55",
  bus_79: "79",
}

const BUS_TYPE_UI_TO_DB: Record<BusType, DbBusType> = {
  "55": "bus_55",
  "79": "bus_79",
}

export function fromDbBusType(v: DbBusType): BusType {
  return BUS_TYPE_DB_TO_UI[v]
}

export function toDbBusType(v: BusType): DbBusType {
  return BUS_TYPE_UI_TO_DB[v]
}

const TRIP_STATUS_DB_TO_UI: Record<DbTripStatus, TripStatus> = {
  planned: "planned",
  booking: "booking",
  confirmed: "confirmed",
  in_progress: "in-progress",
  completed: "completed",
  cancelled: "cancelled",
}

const TRIP_STATUS_UI_TO_DB: Record<TripStatus, DbTripStatus> = {
  planned: "planned",
  booking: "booking",
  confirmed: "confirmed",
  "in-progress": "in_progress",
  completed: "completed",
  cancelled: "cancelled",
}

export function fromDbTripStatus(v: DbTripStatus): TripStatus {
  return TRIP_STATUS_DB_TO_UI[v]
}

export function toDbTripStatus(v: TripStatus): DbTripStatus {
  return TRIP_STATUS_UI_TO_DB[v]
}
