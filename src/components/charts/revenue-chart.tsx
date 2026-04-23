import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { managers, stats } from "@/data"

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

const chartConfig: ChartConfig = Object.fromEntries(
  managers.map((m, i) => [
    m.id,
    {
      label: m.name,
      color: CHART_COLORS[i % CHART_COLORS.length],
    },
  ]),
) satisfies ChartConfig

export function RevenueChart() {
  const data = stats.revenueByMonth.map((row) => ({
    ...row,
    month: new Date(row.month + "-01").toLocaleDateString("en-US", {
      month: "short",
    }),
  }))

  return (
    <ChartContainer config={chartConfig} className="min-h-[280px] w-full">
      <BarChart data={data} barCategoryGap="20%">
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} width={50} />
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
