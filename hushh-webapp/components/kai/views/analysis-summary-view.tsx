"use client";

import { ArrowLeft, RefreshCw, Scale } from "lucide-react";

import { Button } from "@/lib/morphy-ux/button";
import { Card, CardContent } from "@/lib/morphy-ux/card";
import { Icon } from "@/lib/morphy-ux/ui";
import type { AnalysisHistoryEntry } from "@/lib/services/kai-history-service";
import { cn } from "@/lib/utils";

interface AnalysisSummaryViewProps {
  entry: AnalysisHistoryEntry;
  onBack: () => void;
  onOpenDebate: () => void;
  onReanalyze: (ticker: string) => void;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace("%", ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickString(values: unknown[], fallback: string): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
}

function formatCurrency(value: number | null): string {
  if (value === null) return "Price unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTimestamp(value: string | undefined): string {
  if (!value) return "Updated recently";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Updated recently";
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function resolveCurrentPrice(rawCard: Record<string, unknown>): number | null {
  const keyMetricsRaw =
    rawCard.key_metrics &&
    typeof rawCard.key_metrics === "object" &&
    !Array.isArray(rawCard.key_metrics)
      ? (rawCard.key_metrics as Record<string, unknown>)
      : {};
  const valuationRaw =
    keyMetricsRaw.valuation &&
    typeof keyMetricsRaw.valuation === "object" &&
    !Array.isArray(keyMetricsRaw.valuation)
      ? (keyMetricsRaw.valuation as Record<string, unknown>)
      : {};
  const priceTargetsRaw =
    rawCard.price_targets &&
    typeof rawCard.price_targets === "object" &&
    !Array.isArray(rawCard.price_targets)
      ? (rawCard.price_targets as Record<string, unknown>)
      : {};

  return (
    readNumber(rawCard.current_price) ??
    readNumber(valuationRaw.current_price) ??
    readNumber(valuationRaw.price) ??
    readNumber(priceTargetsRaw.current_price) ??
    readNumber(priceTargetsRaw.current) ??
    readNumber(priceTargetsRaw.market_price)
  );
}

function ScoreBar({
  label,
  description,
  value,
  valueLabel,
  tone,
}: {
  label: string;
  description: string;
  value: number | null;
  valueLabel?: string;
  tone: "neutral" | "positive" | "warning";
}) {
  const clamped = value === null ? null : Math.max(0, Math.min(10, value));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-sm font-bold tabular-nums">
          {valueLabel || (clamped === null ? "N/A" : `${clamped.toFixed(1)} / 10`)}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            tone === "positive" && "bg-emerald-500",
            tone === "warning" && "bg-blue-500",
            tone === "neutral" && "bg-zinc-900 dark:bg-zinc-100"
          )}
          style={{ width: `${clamped === null ? 0 : clamped * 10}%` }}
        />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

export function AnalysisSummaryView({
  entry,
  onBack,
  onOpenDebate,
  onReanalyze,
}: AnalysisSummaryViewProps) {
  const rawCard = (entry.raw_card || {}) as Record<string, unknown>;
  const entryRecord = entry as unknown as Record<string, unknown>;

  const companyStrength = readNumber(rawCard.company_strength_score);
  const marketTrendScore = readNumber(rawCard.market_trend_score);
  const fairValueScore = readNumber(rawCard.fair_value_score);
  const fairValueGapPct = readNumber(rawCard.fair_value_gap_pct);
  const marketTrendLabel = String(rawCard.market_trend_label || "Trend unavailable");
  const fairValueLabel = String(rawCard.fair_value_label || "Fair value unavailable");
  const currentPrice = resolveCurrentPrice(rawCard);
  const priceLabel = formatCurrency(currentPrice);
  const fairValueGapLabel =
    fairValueGapPct === null
      ? null
      : `${fairValueGapPct >= 0 ? "+" : ""}${fairValueGapPct.toFixed(1)}% gap`;
  const companyStrengthDetail = pickString(
    [
      (rawCard.fundamental_insight as Record<string, unknown> | undefined)?.summary,
      entryRecord.fundamental_summary,
      entry.final_statement,
    ],
    "Company fundamentals summary is being refreshed."
  );
  const marketTrendDetail = pickString(
    [entryRecord.sentiment_summary, rawCard.debate_digest, entry.final_statement],
    "Market trend context is being refreshed."
  );
  const fairValueDetail = pickString(
    [entryRecord.valuation_summary, rawCard.debate_digest, entry.final_statement],
    "Fair value context is being refreshed."
  );
  const shortRecommendation = String(
    rawCard.short_recommendation || entry.final_statement || "Recommendation unavailable."
  );
  const updatedAt = formatTimestamp(String(rawCard.analysis_updated_at || entry.timestamp || ""));

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-safe pt-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="none" effect="fade" size="sm" onClick={onBack}>
          <Icon icon={ArrowLeft} size="sm" className="mr-1" />
          History
        </Button>
        <Button variant="none" effect="fade" size="sm" onClick={() => onReanalyze(entry.ticker)}>
          <Icon icon={RefreshCw} size="sm" className="mr-1" />
          Re-analyze
        </Button>
      </div>

      <div className="flex items-center gap-4 px-1">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-black text-lg font-black text-white dark:bg-white dark:text-black">
          {entry.ticker.slice(0, 1)}
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight leading-tight">{entry.ticker} Insight</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{priceLabel}</span>
            {fairValueGapLabel ? (
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {fairValueGapLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <Card variant="none" effect="glass" className="rounded-3xl p-0">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Analysis</span>
            <span className="text-xs font-medium text-muted-foreground">{updatedAt}</span>
          </div>

          <ScoreBar
            label="Company Strength"
            value={companyStrength}
            tone="neutral"
            description={companyStrengthDetail}
          />

          <ScoreBar
            label="Market Trend"
            value={marketTrendScore}
            valueLabel={marketTrendLabel}
            tone="positive"
            description={marketTrendDetail}
          />

          <ScoreBar
            label="Fair Value"
            value={fairValueScore}
            valueLabel={fairValueLabel}
            tone="warning"
            description={fairValueDetail}
          />
        </CardContent>
      </Card>

      <Card variant="muted" effect="fill" className="rounded-2xl p-0">
        <CardContent className="space-y-3 p-4">
          <div className="border-l-2 border-primary pl-3">
            <p className="text-sm font-medium leading-relaxed">{shortRecommendation}</p>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Kai Insight
            </p>
          </div>
          <Button variant="blue-gradient" effect="fill" size="sm" onClick={onOpenDebate}>
            <Icon icon={Scale} size="sm" className="mr-1" />
            Open Detailed Debate
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
