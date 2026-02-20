"use client";

import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/lib/morphy-ux/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface ConcentrationDatum {
  symbol: string;
  name: string;
  marketValue: number;
  weightPct: number;
}

interface HoldingsConcentrationChartProps {
  data: ConcentrationDatum[];
  className?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function HoldingsConcentrationChart({
  data,
  className,
}: HoldingsConcentrationChartProps) {
  const chartData = data.slice(0, 8);
  const chartConfig = useMemo<ChartConfig>(
    () => ({
      weightPct: {
        label: "Weight %",
        color: "var(--chart-3)",
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
          <BarChart3 className="h-4 w-4 text-primary" />
          Holdings Concentration
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={chartConfig} className="h-[230px] w-full">
          <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="symbol"
              width={56}
              axisLine={false}
              tickLine={false}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(_value, _name, item) => {
                    const payload = item.payload as ConcentrationDatum;
                    return (
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold">{payload.symbol}</span>
                        <span className="text-xs text-muted-foreground truncate">{payload.name}</span>
                        <span className="text-sm font-medium">
                          {payload.weightPct.toFixed(2)}% • {formatCurrency(payload.marketValue)}
                        </span>
                      </div>
                    );
                  }}
                />
              }
            />
            <Bar dataKey="weightPct" radius={[0, 6, 6, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`${entry.symbol}-${index}`}
                  fill={`var(--chart-${(index % 5) + 1})`}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
