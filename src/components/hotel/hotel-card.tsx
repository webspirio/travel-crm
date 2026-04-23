import { MapPin, Star } from "lucide-react"

import { AspectRatio } from "@/components/ui/aspect-ratio"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Hotel, RoomType } from "@/types"

import { RoomProgress } from "./room-progress"

const ROOM_TYPES: RoomType[] = ["single", "double", "triple", "family"]

interface HotelCardProps {
  hotel: Hotel
  bookedByType?: Partial<Record<RoomType, number>>
}

export function HotelCard({ hotel, bookedByType = {} }: HotelCardProps) {
  return (
    <Card className="overflow-hidden">
      <AspectRatio ratio={16 / 9} className="bg-gradient-to-br from-sky-200 to-blue-400 dark:from-sky-800 dark:to-blue-950">
        <div className="flex h-full items-center justify-center text-6xl opacity-60">
          🏨
        </div>
      </AspectRatio>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          {hotel.name}
          <span className="ml-auto flex" aria-label={`${hotel.stars} stars`}>
            {Array.from({ length: hotel.stars }).map((_, i) => (
              <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" />
            ))}
          </span>
        </CardTitle>
        <CardDescription className="flex items-center gap-1">
          <MapPin className="size-3.5" />
          {hotel.city}, {hotel.country}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {ROOM_TYPES.map((type) => (
          <RoomProgress
            key={type}
            type={type}
            booked={bookedByType[type] ?? 0}
            total={hotel.rooms[type].total}
          />
        ))}
      </CardContent>
    </Card>
  )
}
