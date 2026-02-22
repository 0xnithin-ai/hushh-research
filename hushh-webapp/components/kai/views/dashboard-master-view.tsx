"use client";

import { useMemo } from "react";
import { Clock3, SlidersHorizontal, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

import { AssetAllocationDonut } from "@/components/kai/charts/asset-allocation-donut";
import { GainLossDistributionChart } from "@/components/kai/charts/gain-loss-distribution-chart";
import { HoldingsConcentrationChart } from "@/components/kai/charts/holdings-concentration-chart";
import { PortfolioHistoryChart } from "@/components/kai/charts/portfolio-history-chart";
import { SectorAllocationChart } from "@/components/kai/charts/sector-allocation-chart";
import type { PortfolioData } from "@/components/kai/types/portfolio";
import { ProfileBasedPicksList } from "@/components/kai/cards/profile-based-picks-list";
import { Button as MorphyButton } from "@/lib/morphy-ux/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/morphy-ux/card";
import { Icon } from "@/lib/morphy-ux/ui";
import { KAI_EXPERIENCE_CONTRACT } from "@/lib/kai/experience-contract";
import { cn } from "@/lib/utils";
import { mapPortfolioToDashboardViewModel } from "@/components/kai/views/dashboard-data-mapper";

interface DashboardMasterViewProps {
  userId: string;
  vaultOwnerToken: string;
  portfolioData: PortfolioData;
  onManagePortfolio: () => void;
  onAnalyzeStock?: (symbol: string) => void;
  onAnalyzeLosers?: () => void;
  onReupload?: () => void;
  onViewHistory?: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function DataQualityFallback({ title, detail }: { title: string; detail: string }) {
  return (
    <Card variant="none" effect="glass" className="h-full min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="rounded-xl border border-dashed border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
          {detail}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardMasterView({
  userId,
  vaultOwnerToken,
  portfolioData,
  onManagePortfolio,
  onAnalyzeStock,
  onAnalyzeLosers,
  onReupload,
  onViewHistory,
}: DashboardMasterViewProps) {
  const model = useMemo(() => mapPortfolioToDashboardViewModel(portfolioData), [portfolioData]);
  const holdingSymbols = useMemo(
    () =>
      model.holdings
        .map((holding) => String(holding.symbol || "").trim().toUpperCase())
        .filter((symbol, idx, arr) => Boolean(symbol) && arr.indexOf(symbol) === idx)
        .slice(0, 20),
    [model.holdings]
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-[calc(148px+var(--app-bottom-inset))] pt-2 sm:px-6">
      <Card variant="none" effect="glass" className="overflow-hidden">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5">
              Portfolio Concentration: {model.hero.portfolioConcentrationLabel}
            </span>
            <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5">
              Holdings: {model.hero.holdingsCount}
            </span>
            {model.sourceBrokerage && (
              <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5">
                Source: {model.sourceBrokerage}
              </span>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total Portfolio Value</p>
            <p className="text-3xl font-black tracking-tight sm:text-4xl">
              {formatCurrency(model.hero.totalValue)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={cn(
                "inline-flex items-center gap-1 font-semibold",
                model.hero.netChange >= 0 ? "text-emerald-500" : "text-red-500"
              )}
            >
              <Icon
                icon={model.hero.netChange >= 0 ? TrendingUp : TrendingDown}
                size="sm"
              />
              {model.hero.netChange >= 0 ? "+" : ""}
              {formatCurrency(model.hero.netChange)} ({model.hero.changePct.toFixed(2)}%)
            </span>
            {model.hero.statementPeriod && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">{model.hero.statementPeriod}</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <MorphyButton variant="none" effect="fade" fullWidth onClick={onManagePortfolio}>
          <Icon icon={SlidersHorizontal} size="sm" className="mr-2" />
          Manage
        </MorphyButton>
        <MorphyButton variant="none" effect="fade" fullWidth onClick={onViewHistory}>
          <Icon icon={Clock3} size="sm" className="mr-2" />
          History
        </MorphyButton>
        <MorphyButton variant="none" effect="fade" fullWidth onClick={onAnalyzeLosers}>
          <Icon icon={Sparkles} size="sm" className="mr-2" />
          Optimize
        </MorphyButton>
      </div>

      <Card variant="none" effect="glass" className="min-w-0">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">Top Holdings</CardTitle>
            <MorphyButton variant="none" effect="fade" size="sm" onClick={onManagePortfolio}>
              Manage Holdings
            </MorphyButton>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {model.holdings.slice(0, 8).map((holding) => (
            <div
              key={`${holding.symbol}-${holding.name}`}
              className="rounded-xl border border-border/60 bg-background/70 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{holding.symbol}</p>
                  <p className="truncate text-xs text-muted-foreground">{holding.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(holding.market_value)}</p>
                  <p className="text-xs text-muted-foreground">
                    {holding.quantity.toLocaleString()} @ {formatCurrency(holding.price)}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <p
                  className={cn(
                    "text-xs font-medium",
                    (holding.unrealized_gain_loss || 0) >= 0 ? "text-emerald-500" : "text-red-500"
                  )}
                >
                  {(holding.unrealized_gain_loss || 0) >= 0 ? "+" : ""}
                  {formatCurrency(holding.unrealized_gain_loss || 0)}
                  {typeof holding.unrealized_gain_loss_pct === "number"
                    ? ` (${holding.unrealized_gain_loss_pct.toFixed(2)}%)`
                    : ""}
                </p>
                <MorphyButton
                  variant="none"
                  effect="fade"
                  size="sm"
                  onClick={() => onAnalyzeStock?.(holding.symbol)}
                >
                  Analyze
                </MorphyButton>
              </div>
            </div>
          ))}

          {model.holdings.length === 0 && (
            <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
              No holdings found in this statement. Import another document to populate dashboard analytics.
            </div>
          )}
          {model.holdings.length > 0 && (
            <p className="px-1 text-xs text-muted-foreground">
              {KAI_EXPERIENCE_CONTRACT.portfolioClarity.dashboardPrimaryDescription}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {model.quality.allocationReady ? (
        <Card variant="none" effect="glass" className="min-w-0 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Allocation Mix</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <AssetAllocationDonut data={model.allocation} height={240} />
          </CardContent>
        </Card>
        ) : (
          <DataQualityFallback
            title="Allocation Mix"
            detail="Insufficient statement allocation fields to build a reliable mix chart."
          />
        )}

        {model.quality.historyReady ? (
          <PortfolioHistoryChart
            data={model.history}
            beginningValue={model.hero.beginningValue}
            endingValue={model.hero.endingValue}
            statementPeriod={model.hero.statementPeriod}
            className="h-full min-w-0 overflow-hidden"
          />
        ) : (
          <DataQualityFallback
            title="Portfolio History"
            detail="Insufficient statement period values to plot a defensible history trend."
          />
        )}

        {model.quality.sectorReady ? (
          <SectorAllocationChart
            className="min-w-0 overflow-hidden"
            holdings={model.holdings.map((holding) => ({
              symbol: holding.symbol,
              name: holding.name,
              market_value: holding.market_value,
              sector: holding.sector,
              asset_type: holding.asset_type,
            }))}
          />
        ) : (
          <DataQualityFallback
            title="Sector Allocation"
            detail={`Only ${(model.quality.sectorCoveragePct * 100).toFixed(0)}% of holdings include sector labels.`}
          />
        )}

        {model.quality.concentrationReady ? (
          <HoldingsConcentrationChart className="min-w-0 overflow-hidden" data={model.concentration} />
        ) : (
          <DataQualityFallback
            title="Holdings Concentration"
            detail="Need at least three measurable holdings to compute concentration safely."
          />
        )}

        {model.quality.gainLossReady ? (
          <GainLossDistributionChart className="min-w-0 overflow-hidden" data={model.gainLossDistribution} />
        ) : (
          <DataQualityFallback
            title="Gain/Loss Distribution"
            detail="Statement lacks enough gain/loss percentages to build a reliable distribution."
          />
        )}

        <Card variant="none" effect="glass" className="min-w-0 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <p className="text-xs text-muted-foreground">
              {KAI_EXPERIENCE_CONTRACT.decisionConviction.dashboardRecommendationsDescription}
            </p>
            {model.recommendations.map((item) => (
              <div key={item.title} className="rounded-xl border border-border/60 bg-background/70 p-3">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card variant="none" effect="glass" className="min-w-0 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Profile Picks</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ProfileBasedPicksList
              userId={userId}
              vaultOwnerToken={vaultOwnerToken}
              symbols={holdingSymbols}
              onAdd={(symbol) => onAnalyzeStock?.(symbol)}
            />
          </CardContent>
        </Card>
      </div>

      <Card variant="none" effect="glass">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs text-muted-foreground">
          <p>Dashboard mirrors parsed statement data and updates after each portfolio CRUD sync.</p>
          <MorphyButton variant="none" effect="fade" size="sm" onClick={onReupload}>
            Import New Statement
          </MorphyButton>
        </CardContent>
      </Card>
    </div>
  );
}
