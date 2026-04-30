import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { useBookings } from "@/hooks/queries/use-bookings"
import { useHotels } from "@/hooks/queries/use-hotels"
import { useManagers } from "@/hooks/queries/use-managers"
import { useTrips } from "@/hooks/queries/use-trips"
import { computeDashboardStats } from "@/lib/stats"

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export function RevenueChart() {
  const { data: managers = [] } = useManagers()
  const { data: trips = [] } = useTrips()
  const { data: bookings = [] } = useBookings()
  const { data: hotels = [] } = useHotels()

  const chartConfig: ChartConfig = useMemo(
    () =>
      Object.fromEntries(
        managers.map((m, i) => [
          m.id,
          {
            label: m.name,
            color: CHART_COLORS[i % CHART_COLORS.length],
          },
        ]),
      ),
    [managers],
  )

  const data = useMemo(() => {
    const stats = computeDashboardStats(trips, bookings, hotels, managers)
    return stats.revenueByMonth.map((row) => ({
      ...row,
      month: new Date(row.month + "-01").toLocaleDateString("en-US", {
        month: "short",
      }),
    }))
  }, [trips, bookings, hotels, managers])

  return (
    <ChartContainer config={chartConfig} className="min-h-[280px] w-full">
      <BarChart data={data} barCategoryGap="20%">
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={70}
          tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {managers.map((m) => (
          <Bar
            key={m.id}
            dataKey={m.id}
            stackId="revenue"
            fill={`var(--color-${m.id})`}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
