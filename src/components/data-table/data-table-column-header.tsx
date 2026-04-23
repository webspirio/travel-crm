import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import type { Column } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Props<TData, TValue> {
  column: Column<TData, TValue>
  title: string
  className?: string
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: Props<TData, TValue>) {
  if (!column.getCanSort()) {
    return <span className={className}>{title}</span>
  }

  const sort = column.getIsSorted()

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("-ml-3 h-8", className)}
      onClick={() => column.toggleSorting(sort === "asc")}
    >
      <span>{title}</span>
      {sort === "asc" ? (
        <ArrowUp className="ml-2 size-3.5" />
      ) : sort === "desc" ? (
        <ArrowDown className="ml-2 size-3.5" />
      ) : (
        <ArrowUpDown className="ml-2 size-3.5 opacity-50" />
      )}
    </Button>
  )
}
