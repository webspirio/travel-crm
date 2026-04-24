import type { TripStatus } from "@/types"

export function tripStatusVariant(
  s: TripStatus,
): "default" | "secondary" | "outline" | "destructive" {
  switch (s) {
    case "confirmed":
    case "in-progress":
      return "default"
    case "booking":
      return "secondary"
    case "cancelled":
      return "destructive"
    default:
      return "outline"
  }
}

export const TRIP_STATUS_CLASS: Record<TripStatus, string> = {
  planned: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  booking: "bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100",
  confirmed: "bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100",
  "in-progress": "bg-sky-200 text-sky-900 dark:bg-sky-900/60 dark:text-sky-100",
  completed: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
  cancelled: "bg-rose-200 text-rose-900 dark:bg-rose-900/60 dark:text-rose-100",
}

export const ALL_TRIP_STATUSES: TripStatus[] = [
  "planned",
  "booking",
  "confirmed",
  "in-progress",
  "completed",
  "cancelled",
]
