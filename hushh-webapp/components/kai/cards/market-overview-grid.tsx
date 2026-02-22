"use client";

import { Activity, ChartColumnIncreasing, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/lib/morphy-ux/card";
import { Icon } from "@/lib/morphy-ux/ui";
import { cn } from "@/lib/utils";

export interface MarketOverviewMetric {
  id?: string;
  label: string;
  value: string;
  delta: string;
  tone: "positive" | "negative" | "neutral" | "warning";
  icon: LucideIcon;
}

const FALLBACK_ICON: Record<MarketOverviewMetric["tone"], LucideIcon> = {
  positive: TrendingUp,
  negative: TrendingDown,
  neutral: ChartColumnIncreasing,
  warning: Activity,
};

export function MarketOverviewGrid({ metrics = [] }: { metrics?: MarketOverviewMetric[] }) {
  if (!metrics.length) {
    return (
      <Card variant="muted" effect="fill" className="rounded-xl p-0">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Market overview metrics are not available at the moment.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {metrics.map((metric) => (
        <Card
          key={metric.id || metric.label}
          variant="muted"
          effect="fill"
          className="rounded-xl p-0"
        >
          <CardContent className="flex h-[110px] flex-col justify-between p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">{metric.label}</span>
              <Icon icon={metric.icon || FALLBACK_ICON[metric.tone]} size="sm" className="text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-black tracking-tight leading-none">{metric.value}</p>
              <p
                className={cn(
                  "text-xs font-bold",
                  metric.tone === "positive" && "text-emerald-600 dark:text-emerald-400",
                  metric.tone === "negative" && "text-rose-600 dark:text-rose-400",
                  metric.tone === "warning" && "text-orange-600 dark:text-orange-400",
                  metric.tone === "neutral" && "text-muted-foreground"
                )}
              >
                {metric.delta}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
