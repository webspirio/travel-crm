import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table"
import { useState } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { DataTablePagination } from "./data-table-pagination"
import { DataTableToolbar } from "./data-table-toolbar"

interface Props<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchColumn?: string
  searchPlaceholder?: string
  toolbarExtra?: React.ReactNode
  onRowClick?: (row: TData) => void
  emptyMessage?: string
  isLoading?: boolean
  // --- server-side mode ---
  manualPagination?: boolean
  manualSorting?: boolean
  manualFiltering?: boolean
  pageCount?: number
  rowCount?: number
  state?: {
    sorting?: SortingState
    columnFilters?: ColumnFiltersState
    pagination?: PaginationState
  }
  onSortingChange?: OnChangeFn<SortingState>
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>
  onPaginationChange?: OnChangeFn<PaginationState>
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchColumn,
  searchPlaceholder,
  toolbarExtra,
  onRowClick,
  emptyMessage = "No results.",
  isLoading,
  manualPagination,
  manualSorting,
  manualFiltering,
  pageCount,
  rowCount,
  state,
  onSortingChange,
  onColumnFiltersChange,
  onPaginationChange,
}: Props<TData, TValue>) {
  // Local fallback state — always declared so hook order stays stable.
  const [localSorting, setLocalSorting] = useState<SortingState>([])
  const [localColumnFilters, setLocalColumnFilters] = useState<ColumnFiltersState>([])
  const [localPagination, setLocalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const sortingControlled = state?.sorting !== undefined
  const filtersControlled = state?.columnFilters !== undefined
  const paginationControlled = state?.pagination !== undefined

  const effectiveSorting = sortingControlled ? state!.sorting! : localSorting
  const effectiveFilters = filtersControlled
    ? state!.columnFilters!
    : localColumnFilters
  const effectivePagination = paginationControlled
    ? state!.pagination!
    : localPagination

  const handleSortingChange: OnChangeFn<SortingState> = onSortingChange
    ? onSortingChange
    : setLocalSorting
  const handleFiltersChange: OnChangeFn<ColumnFiltersState> = onColumnFiltersChange
    ? onColumnFiltersChange
    : setLocalColumnFilters
  const handlePaginationChange: OnChangeFn<PaginationState> = onPaginationChange
    ? onPaginationChange
    : setLocalPagination

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting: effectiveSorting,
      columnFilters: effectiveFilters,
      pagination: effectivePagination,
    },
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: handleFiltersChange,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination,
    manualSorting,
    manualFiltering,
    pageCount,
    rowCount,
  })

  const rows = table.getRowModel().rows

  return (
    <div className="space-y-3">
      <DataTableToolbar
        table={table}
        searchColumn={searchColumn}
        searchPlaceholder={searchPlaceholder}
      >
        {toolbarExtra}
      </DataTableToolbar>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={onRowClick ? "cursor-pointer" : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  )
}
