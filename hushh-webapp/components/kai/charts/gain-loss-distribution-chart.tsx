"use client";

import { useMemo } from "react";
import { TrendingUpDown } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/lib/morphy-ux/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface GainLossBandDatum {
  band: string;
  count: number;
}

interface GainLossDistributionChartProps {
  data: GainLossBandDatum[];
  className?: string;
}

function bandColor(band: string): string {
  if (band.includes("< -10") || band.includes("-10% to -2%")) {
    return "var(--destructive)";
  }
  if (band.includes("-2% to +2%")) {
    return "var(--chart-4)";
  }
  return "var(--chart-2)";
}

function compactBandLabel(band: string): string {
  return band
    .replace(" to ", "→")
    .replace("%", "%")
    .replace(" ", "");
}

export function GainLossDistributionChart({
  data,
  className,
}: GainLossDistributionChartProps) {
  const chartData = data.filter((row) => row.count > 0);
  const chartConfig = useMemo<ChartConfig>(
    () => ({
      count: {
        label: "Holdings",
        color: "var(--chart-2)",
      },
    }),
    []
  );

  if (chartData.length === 0) {
    return null;
  }

  return (
    <Card variant="none" effect="glass" className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUpDown className="h-4 w-4 text-primary" />
          Gain/Loss Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 min-w-0 overflow-hidden">
        <ChartContainer config={chartConfig} className="h-[220px] w-full min-w-0">
          <BarChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="band"
              tickFormatter={(value) => compactBandLabel(String(value))}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              interval={0}
              tick={{ fontSize: 10 }}
            />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideIndicator
                  labelFormatter={(_label, payload) => {
                    const first = payload?.[0]?.payload as GainLossBandDatum | undefined;
                    return first?.band || "Range";
                  }}
                  formatter={(value) => {
                    const count = typeof value === "number" ? value : Number(value || 0);
                    const suffix = count === 1 ? "" : "s";
                    return <span className="text-sm text-muted-foreground">{count} holding{suffix}</span>;
                  }}
                />
              }
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.band} fill={bandColor(entry.band)} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
