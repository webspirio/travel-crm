import { useTranslation } from "react-i18next"

import { Progress } from "@/components/ui/progress"
import type { RoomType } from "@/types"

interface RoomProgressProps {
  type: RoomType
  booked: number
  total: number
}

export function RoomProgress({ type, booked, total }: RoomProgressProps) {
  const { t } = useTranslation()
  const percent = total > 0 ? Math.round((booked / total) * 100) : 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{t(`room.${type}`)}</span>
        <span className="tabular-nums text-muted-foreground">
          {booked}/{total}
        </span>
      </div>
      <Progress value={percent} />
    </div>
  )
}
