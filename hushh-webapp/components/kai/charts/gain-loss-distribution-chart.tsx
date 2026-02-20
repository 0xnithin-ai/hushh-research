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
      <CardContent className="pt-0">
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <BarChart data={chartData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="band"
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              interval={0}
            />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(_value, _name, item) => {
                    const payload = item.payload as GainLossBandDatum;
                    return (
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold">{payload.band}</span>
                        <span className="text-sm">{payload.count} holding(s)</span>
                      </div>
                    );
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
