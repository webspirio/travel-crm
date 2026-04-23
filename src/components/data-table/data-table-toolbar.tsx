import { Search, X } from "lucide-react"
import type { Table } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Props<TData> {
  table: Table<TData>
  searchColumn?: string
  searchPlaceholder?: string
  children?: React.ReactNode
}

export function DataTableToolbar<TData>({
  table,
  searchColumn,
  searchPlaceholder = "Search…",
  children,
}: Props<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0
  const searchCol = searchColumn ? table.getColumn(searchColumn) : undefined
  const searchValue = (searchCol?.getFilterValue() as string | undefined) ?? ""

  return (
    <div className="flex flex-wrap items-center gap-2">
      {searchCol && (
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => searchCol.setFilterValue(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
      )}
      {children}
      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => table.resetColumnFilters()}
          className="h-9"
        >
          Reset
          <X className="ml-1 size-4" />
        </Button>
      )}
    </div>
  )
}
