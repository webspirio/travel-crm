import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

export const STEPS = ["trip", "travelers", "seats", "rooms", "review"] as const
export type StepId = (typeof STEPS)[number]

interface StepperProps {
  current: number
}

export function Stepper({ current }: StepperProps) {
  const { t } = useTranslation("booking")
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {STEPS.map((id, idx) => {
        const done = idx < current
        const active = idx === current
        return (
          <li key={id} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full border text-xs font-medium",
                done && "border-primary bg-primary text-primary-foreground",
                active && !done && "border-primary text-primary",
                !active && !done && "border-border text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" /> : idx + 1}
            </span>
            <span
              className={cn(
                "hidden sm:inline",
                active ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {t(`steps.${id}`)}
            </span>
            {idx < STEPS.length - 1 && (
              <span className="hidden h-px w-8 bg-border sm:inline-block" />
            )}
          </li>
        )
      })}
    </ol>
  )
}
