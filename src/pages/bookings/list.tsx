import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useSearchParams } from "react-router"
import { CalendarRange, Check, PlusIcon, Wallet, X } from "lucide-react"
import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  SortingState,
} from "@tanstack/react-table"

import { DataTable } from "@/components/data-table/data-table"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  type BookingsListParams,
  type BookingsListRow,
  useBookingsList,
} from "@/hooks/queries/use-bookings"
import { useManagers } from "@/hooks/queries/use-managers"
import { useTrips } from "@/hooks/queries/use-trips"
import { bookingStatusVariant, type BookingStatus } from "@/lib/booking-status"
import { formatCurrency, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Locale } from "@/types"

// Status values the DB enum supports. Listed explicitly so we can render
// a faceted filter without rebuilding it from the table data.
const ALL_STATUSES: BookingStatus[] = [
  "draft",
  "confirmed",
  "partially_paid",
  "paid",
  "cancelled",
  "no_show",
]

const PAGE_SIZES = [20, 50, 100]
const DEFAULT_PAGE_SIZE = 20

// --- URL <-> params helpers ---------------------------------------------
//
// Status is encoded as repeating `?status=draft&status=confirmed` for
// readability and to dodge any client-side comma-encoding concerns.

interface ParsedUrlState {
  q: string
  status: BookingStatus[]
  trip: string | null
  manager: string | null
  from: string | null // YYYY-MM-DD
  to: string | null // YYYY-MM-DD
  outstanding: boolean
  sortId: string
  sortDesc: boolean
  pageIndex: number
  pageSize: number
}

const DEFAULT_SORT_ID = "created_at"
const DEFAULT_SORT_DESC = true

function parseSearchParams(sp: URLSearchParams): ParsedUrlState {
  const status = sp.getAll("status").filter((s): s is BookingStatus =>
    (ALL_STATUSES as string[]).includes(s),
  )
  const sortRaw = sp.get("sort")
  let sortId = DEFAULT_SORT_ID
  let sortDesc = DEFAULT_SORT_DESC
  if (sortRaw) {
    const [id, dir] = sortRaw.split(":")
    if (id) {
      sortId = id
      sortDesc = dir === "asc" ? false : true
    }
  }
  const pageRaw = Number(sp.get("page") ?? "1")
  const sizeRaw = Number(sp.get("size") ?? String(DEFAULT_PAGE_SIZE))
  const pageIndex = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw - 1 : 0
  const pageSize = PAGE_SIZES.includes(sizeRaw) ? sizeRaw : DEFAULT_PAGE_SIZE

  return {
    q: sp.get("q") ?? "",
    status,
    trip: sp.get("trip"),
    manager: sp.get("manager"),
    from: sp.get("from"),
    to: sp.get("to"),
    outstanding: sp.get("outstanding") === "1",
    sortId,
    sortDesc,
    pageIndex,
    pageSize,
  }
}

function serializeUrlState(state: ParsedUrlState): URLSearchParams {
  const out = new URLSearchParams()
  if (state.q) out.set("q", state.q)
  for (const s of state.status) out.append("status", s)
  if (state.trip) out.set("trip", state.trip)
  if (state.manager) out.set("manager", state.manager)
  if (state.from) out.set("from", state.from)
  if (state.to) out.set("to", state.to)
  if (state.outstanding) out.set("outstanding", "1")
  if (state.sortId !== DEFAULT_SORT_ID || state.sortDesc !== DEFAULT_SORT_DESC) {
    out.set("sort", `${state.sortId}:${state.sortDesc ? "desc" : "asc"}`)
  }
  if (state.pageIndex > 0) out.set("page", String(state.pageIndex + 1))
  if (state.pageSize !== DEFAULT_PAGE_SIZE) out.set("size", String(state.pageSize))
  return out
}

function toListParams(state: ParsedUrlState): BookingsListParams {
  // Default: hide cancelled by leaving the status filter empty unless the
  // user explicitly selects something. The hook only filters when the
  // array is non-empty, so we inject an "all-non-cancelled" set here.
  const status =
    state.status.length > 0
      ? state.status
      : (["draft", "confirmed", "partially_paid", "paid", "no_show"] as BookingStatus[])

  // Date "to" is YYYY-MM-DD; the view's trip_departure_at is timestamptz.
  // Push the upper bound to end-of-day so the lte comparison includes it.
  const departureTo = state.to ? `${state.to}T23:59:59.999Z` : undefined
  const departureFrom = state.from ? `${state.from}T00:00:00.000Z` : undefined

  return {
    search: state.q || undefined,
    status,
    tripId: state.trip ?? undefined,
    soldByManagerId: state.manager ?? undefined,
    departureFrom,
    departureTo,
    outstandingOnly: state.outstanding || undefined,
    sorting: [{ id: state.sortId, desc: state.sortDesc }],
    pagination: { pageIndex: state.pageIndex, pageSize: state.pageSize },
  }
}

// --- Page ----------------------------------------------------------------

export default function BookingsListPage() {
  const { t } = useTranslation("bookings")
  const { t: tc, i18n } = useTranslation()
  const locale = (i18n.resolvedLanguage ?? "uk") as Locale
  const navigate = useNavigate()

  const [searchParams, setSearchParams] = useSearchParams()
  const url = useMemo(() => parseSearchParams(searchParams), [searchParams])

  // Search is debounced into the URL via a ref-based timer. We deliberately
  // initialise local input state from the URL exactly once — bidirectional
  // sync would cause cascading effects (and trips the
  // react-hooks/set-state-in-effect rule).
  const [searchInput, setSearchInput] = useState(url.q)
  const debounceRef = useRef<number | null>(null)

  function handleSearchInput(value: string) {
    setSearchInput(value)
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current)
    }
    debounceRef.current = window.setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value) next.set("q", value)
          else next.delete("q")
          // Reset to first page on new search.
          next.delete("page")
          return next
        },
        { replace: true },
      )
    }, 250)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    }
  }, [])

  const params = useMemo(() => toListParams(url), [url])
  const query = useBookingsList(params)
  const { data: trips = [] } = useTrips()
  const { data: managers = [] } = useManagers()

  // --- URL mutators ------------------------------------------------------

  function patchUrl(patch: Partial<ParsedUrlState>, opts?: { replace?: boolean }) {
    const next = serializeUrlState({ ...url, ...patch })
    setSearchParams(next, { replace: opts?.replace ?? false })
  }

  function setStatusFilter(values: BookingStatus[]) {
    patchUrl({ status: values, pageIndex: 0 })
  }
  function setTripFilter(tripId: string | null) {
    patchUrl({ trip: tripId, pageIndex: 0 })
  }
  function setManagerFilter(managerId: string | null) {
    patchUrl({ manager: managerId, pageIndex: 0 })
  }
  function setDeparture(from: string | null, to: string | null) {
    patchUrl({ from, to, pageIndex: 0 })
  }
  function toggleOutstanding() {
    patchUrl({ outstanding: !url.outstanding, pageIndex: 0 })
  }
  function resetAll() {
    setSearchParams(new URLSearchParams())
  }

  // --- TanStack controlled state -----------------------------------------
  //
  // The controlled state we feed to <DataTable> is derived from the URL.
  // Change handlers translate TanStack updates back into URL writes.

  const sorting: SortingState = useMemo(
    () => [{ id: url.sortId, desc: url.sortDesc }],
    [url.sortId, url.sortDesc],
  )
  const pagination: PaginationState = useMemo(
    () => ({ pageIndex: url.pageIndex, pageSize: url.pageSize }),
    [url.pageIndex, url.pageSize],
  )
  // We expose the status faceted filter via TanStack columnFilters so the
  // existing `DataTableFacetedFilter` (which writes to a column) keeps
  // working. Other filters live as bespoke UI bound directly to the URL.
  const columnFilters: ColumnFiltersState = useMemo(() => {
    const out: ColumnFiltersState = []
    if (url.status.length > 0) out.push({ id: "status", value: url.status })
    return out
  }, [url.status])

  const handleSortingChange = (
    updater: SortingState | ((old: SortingState) => SortingState),
  ) => {
    const next = typeof updater === "function" ? updater(sorting) : updater
    if (next.length === 0) {
      // TanStack toggles sort off after desc. Snap back to default.
      patchUrl({ sortId: DEFAULT_SORT_ID, sortDesc: DEFAULT_SORT_DESC, pageIndex: 0 })
    } else {
      const first = next[0]
      patchUrl({ sortId: first.id, sortDesc: first.desc, pageIndex: 0 })
    }
  }

  const handlePaginationChange = (
    updater: PaginationState | ((old: PaginationState) => PaginationState),
  ) => {
    const next = typeof updater === "function" ? updater(pagination) : updater
    patchUrl({ pageIndex: next.pageIndex, pageSize: next.pageSize })
  }

  const handleColumnFiltersChange = (
    updater: ColumnFiltersState | ((old: ColumnFiltersState) => ColumnFiltersState),
  ) => {
    const next = typeof updater === "function" ? updater(columnFilters) : updater
    const statusEntry = next.find((f) => f.id === "status")
    const statusValues = (statusEntry?.value as BookingStatus[] | undefined) ?? []
    setStatusFilter(statusValues)
  }

  // --- Columns -----------------------------------------------------------

  const columns = useMemo<ColumnDef<BookingsListRow>[]>(
    () => [
      {
        id: "booking_number",
        accessorKey: "booking_number",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("columns.bookingNumber")} />
        ),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {row.original.booking_number ?? "—"}
          </span>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("columns.status")} />
        ),
        // server-side filtering — the column-level filter value is read by
        // the page (via columnFilters state) and forwarded to the hook.
        // The default filterFn is irrelevant in manualFiltering mode.
        cell: ({ row }) => {
          const s = row.original.status
          if (!s) return <span className="text-xs text-muted-foreground">—</span>
          return <Badge variant={bookingStatusVariant(s)}>{t(`status.${s}`)}</Badge>
        },
      },
      {
        id: "client_full_name",
        accessorKey: "client_full_name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("columns.client")} />
        ),
        cell: ({ row }) => (
          <span className="text-sm">{row.original.client_full_name ?? "—"}</span>
        ),
      },
      {
        id: "trip_name",
        accessorKey: "trip_name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("columns.trip")} />
        ),
        cell: ({ row }) => (
          <div className="text-sm">
            <div>{row.original.trip_name ?? "—"}</div>
            {row.original.trip_departure_at && (
              <div className="text-xs text-muted-foreground">
                {formatDate(new Date(row.original.trip_departure_at), locale)}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "passengers_count",
        accessorKey: "passengers_count",
        enableSorting: false,
        header: () => (
          <span className="text-right">{t("columns.passengers")}</span>
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {row.original.passengers_count ?? 0}
          </div>
        ),
      },
      {
        id: "total_price_eur",
        accessorKey: "total_price_eur",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("columns.total")}
            className="ml-auto"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {formatCurrency(Number(row.original.total_price_eur ?? 0), locale)}
          </div>
        ),
      },
      {
        id: "paid_amount_eur",
        accessorKey: "paid_amount_eur",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("columns.paid")}
            className="ml-auto"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {formatCurrency(Number(row.original.paid_amount_eur ?? 0), locale)}
          </div>
        ),
      },
      {
        id: "outstanding_eur",
        accessorKey: "outstanding_eur",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("columns.balance")}
            className="ml-auto"
          />
        ),
        cell: ({ row }) => {
          const v = Number(row.original.outstanding_eur ?? 0)
          return (
            <div
              className={cn(
                "text-right tabular-nums",
                v === 0 && "text-muted-foreground",
              )}
            >
              {formatCurrency(v, locale)}
            </div>
          )
        },
      },
      {
        id: "sold_by_manager_name",
        accessorKey: "sold_by_manager_name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("columns.soldBy")} />
        ),
        cell: ({ row }) => (
          <span className="text-sm">{row.original.sold_by_manager_name ?? "—"}</span>
        ),
      },
      {
        id: "created_at",
        accessorKey: "created_at",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("columns.createdAt")} />
        ),
        cell: ({ row }) =>
          row.original.created_at ? (
            <span className="text-xs text-muted-foreground">
              {formatDate(new Date(row.original.created_at), locale)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
    ],
    [t, locale],
  )

  // --- Filter chip option lists ------------------------------------------

  const statusOptions = useMemo(
    () => ALL_STATUSES.map((s) => ({ label: t(`status.${s}`), value: s })),
    [t],
  )

  const selectedTrip = trips.find((tr) => tr.id === url.trip) ?? null
  const selectedManager = managers.find((m) => m.id === url.manager) ?? null

  const hasAnyFilter =
    Boolean(url.q) ||
    url.status.length > 0 ||
    Boolean(url.trip) ||
    Boolean(url.manager) ||
    Boolean(url.from) ||
    Boolean(url.to) ||
    url.outstanding

  // --- Render ------------------------------------------------------------

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button size="sm" render={<Link to="/bookings/new" />}>
          <PlusIcon className="size-4" />
          {t("createCta")}
        </Button>
      </div>

      {query.isError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <div className="font-medium">{t("errorTitle")}</div>
          <div className="text-xs opacity-80">
            {query.error instanceof Error
              ? query.error.message
              : String(query.error ?? "")}
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={query.data?.rows ?? []}
        emptyMessage={t("empty")}
        isLoading={query.isLoading || query.isFetching}
        manualPagination
        manualSorting
        manualFiltering
        pageCount={query.data?.pageCount ?? 1}
        rowCount={query.data?.totalRows ?? 0}
        state={{ sorting, columnFilters, pagination }}
        onSortingChange={handleSortingChange}
        onColumnFiltersChange={handleColumnFiltersChange}
        onPaginationChange={handlePaginationChange}
        onRowClick={(row) => {
          if (row.id) navigate(`/bookings/${row.id}`)
        }}
        toolbarExtra={
          <>
            <div className="w-full max-w-xs">
              <Input
                placeholder={t("search")}
                value={searchInput}
                onChange={(e) => handleSearchInput(e.target.value)}
                className="h-9"
              />
            </div>
            <FacetedStatusFilter
              title={t("filters.status")}
              options={statusOptions}
              selected={url.status}
              onChange={setStatusFilter}
            />
            <SinglePickFilter
              title={t("filters.trip")}
              clearLabel={t("filters.anyTrip")}
              selectedValue={selectedTrip?.id ?? null}
              selectedLabel={selectedTrip?.name ?? null}
              options={trips.map((tr) => ({ value: tr.id, label: tr.name }))}
              onChange={setTripFilter}
            />
            <SinglePickFilter
              title={t("filters.manager")}
              clearLabel={t("filters.anyManager")}
              selectedValue={selectedManager?.id ?? null}
              selectedLabel={selectedManager?.name ?? null}
              options={managers.map((m) => ({ value: m.id, label: m.name }))}
              onChange={setManagerFilter}
            />
            <DateRangeFilter
              title={t("filters.departure")}
              fromLabel={t("filters.from")}
              toLabel={t("filters.to")}
              clearLabel={tc("actions.reset")}
              from={url.from}
              to={url.to}
              onChange={setDeparture}
            />
            <Button
              variant={url.outstanding ? "default" : "outline"}
              size="sm"
              className="h-9"
              onClick={toggleOutstanding}
              aria-pressed={url.outstanding}
            >
              <Wallet className="size-4" />
              {t("filters.outstanding")}
            </Button>
            {hasAnyFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9"
                onClick={resetAll}
              >
                {t("filters.reset")}
                <X className="ml-1 size-4" />
              </Button>
            )}
          </>
        }
      />
    </div>
  )
}

// --- Inline filter components ------------------------------------------
//
// Status uses a DataTableFacetedFilter-shaped chip but bound directly to
// our URL state (we don't want it tied to the table's `column` because
// the page is the source of truth for filter values).

interface FacetedStatusFilterProps {
  title: string
  options: { label: string; value: BookingStatus }[]
  selected: BookingStatus[]
  onChange: (next: BookingStatus[]) => void
}

function FacetedStatusFilter({
  title,
  options,
  selected,
  onChange,
}: FacetedStatusFilterProps) {
  // Reuse DataTableFacetedFilter visually by emulating its outer trigger,
  // but drive selection ourselves. Cheaper than retro-fitting that
  // component to take an external value.
  const selectedSet = new Set(selected)
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" size="sm" className="h-9 border-dashed" />}
      >
        <Check className="size-4 opacity-50" />
        {title}
        {selectedSet.size > 0 && (
          <Badge variant="secondary" className="ml-1 rounded-sm px-1 font-normal">
            {selectedSet.size}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>{title}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = selectedSet.has(opt.value)
                return (
                  <CommandItem
                    key={opt.value}
                    onSelect={() => {
                      const next = new Set(selectedSet)
                      if (isSelected) next.delete(opt.value)
                      else next.add(opt.value)
                      onChange(Array.from(next))
                    }}
                  >
                    <div
                      className={cn(
                        "flex size-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <Check className="size-3.5" />
                    </div>
                    <span>{opt.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

interface SinglePickFilterProps {
  title: string
  clearLabel: string
  options: { value: string; label: string }[]
  selectedValue: string | null
  selectedLabel: string | null
  onChange: (value: string | null) => void
}

function SinglePickFilter({
  title,
  clearLabel,
  options,
  selectedValue,
  selectedLabel,
  onChange,
}: SinglePickFilterProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" size="sm" className="h-9 border-dashed" />}
      >
        {title}
        {selectedValue && (
          <Badge variant="secondary" className="ml-1 max-w-[160px] truncate rounded-sm px-1 font-normal">
            {selectedLabel}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>{title}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => onChange(null)}
                className="text-muted-foreground"
              >
                {clearLabel}
              </CommandItem>
              {options.map((opt) => {
                const isSelected = selectedValue === opt.value
                return (
                  <CommandItem
                    key={opt.value}
                    onSelect={() => onChange(isSelected ? null : opt.value)}
                  >
                    <div
                      className={cn(
                        "flex size-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <Check className="size-3.5" />
                    </div>
                    <span className="truncate">{opt.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

interface DateRangeFilterProps {
  title: string
  fromLabel: string
  toLabel: string
  clearLabel: string
  from: string | null
  to: string | null
  onChange: (from: string | null, to: string | null) => void
}

function DateRangeFilter({
  title,
  fromLabel,
  toLabel,
  clearLabel,
  from,
  to,
  onChange,
}: DateRangeFilterProps) {
  // Inputs are fully controlled off props — commit immediately on change
  // so the URL is the single source of truth (no drift, no extra effects).
  const hasValue = Boolean(from) || Boolean(to)

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" size="sm" className="h-9 border-dashed" />}
      >
        <CalendarRange className="size-4" />
        {title}
        {hasValue && (
          <Badge variant="secondary" className="ml-1 rounded-sm px-1 font-normal">
            {[from, to].filter(Boolean).join(" → ") || "·"}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[260px]">
        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="bk-date-from" className="text-xs text-muted-foreground">
              {fromLabel}
            </Label>
            <Input
              id="bk-date-from"
              type="date"
              value={from ?? ""}
              onChange={(e) => onChange(e.target.value || null, to)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bk-date-to" className="text-xs text-muted-foreground">
              {toLabel}
            </Label>
            <Input
              id="bk-date-to"
              type="date"
              value={to ?? ""}
              onChange={(e) => onChange(from, e.target.value || null)}
            />
          </div>
          {hasValue && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => onChange(null, null)}
            >
              {clearLabel}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
