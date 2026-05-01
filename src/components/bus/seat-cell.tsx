import { useTranslation } from "react-i18next"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Cell } from "@/types"

import { STATUS_STYLES } from "./seat-legend"

const SPECIAL_LABEL: Record<string, string> = {
  driver: "🚍",
  door: "🚪",
  toilet: "🚻",
  stairs: "🪜",
  kitchen: "🍽️",
}

interface SeatCellProps {
  cell: Cell
  onSelect?: (seatNumber: number) => void
  /**
   * Short label (e.g. initials) to overlay inside the cell for a draft-assigned
   * passenger in the multi-pax booking flow. Only shown when the cell is in
   * "selected" status. Existing consumers leave this undefined.
   */
  draftLabel?: string
}

export function SeatCellView({ cell, onSelect, draftLabel }: SeatCellProps) {
  const { t } = useTranslation()

  if (!cell) return <div aria-hidden />

  if (cell.type === "special") {
    return (
      <div
        role="presentation"
        className="flex size-10 items-center justify-center rounded border border-dashed border-muted-foreground/40 bg-muted/40 text-base"
        title={t(`seat.${cell.kind}`)}
      >
        <span aria-hidden>{SPECIAL_LABEL[cell.kind]}</span>
        <span className="sr-only">{t(`seat.${cell.kind}`)}</span>
      </div>
    )
  }

  const disabled = cell.status === "sold" || cell.status === "blocked"
  const label = cell.passengerName
    ? `${t("seat.number", { n: cell.number })} — ${cell.passengerName}`
    : `${t("seat.number", { n: cell.number })} — ${t(`seat.${cell.status}`)}`

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect?.(cell.number)}
            aria-label={label}
            className={cn(
              "flex size-10 items-center justify-center rounded border text-xs font-medium tabular-nums transition-colors",
              STATUS_STYLES[cell.status],
              !disabled &&
                cell.status === "free" &&
                "hover:border-primary hover:bg-primary/10",
              disabled && "cursor-not-allowed",
            )}
          >
            {draftLabel && cell.status === "selected" ? (
              <span className="text-[10px] font-bold leading-none">{draftLabel}</span>
            ) : (
              cell.number
            )}
          </button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
