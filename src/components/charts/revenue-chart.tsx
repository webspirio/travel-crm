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
import type { DashboardStats, Manager } from "@/types"

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

type RevenueByMonth = DashboardStats["revenueByMonth"]

interface RevenueChartProps {
  data: RevenueByMonth
  managers: Pick<Manager, "id" | "name">[]
}

export function RevenueChart({ data, managers }: RevenueChartProps) {
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

  const chartData = useMemo(
    () =>
      data.map((row) => ({
        ...row,
        month: new Date(row.month + "-01").toLocaleDateString("en-US", {
          month: "short",
        }),
      })),
    [data],
  )

  return (
    <ChartContainer config={chartConfig} className="min-h-[280px] w-full">
      <BarChart data={chartData} barCategoryGap="20%">
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
