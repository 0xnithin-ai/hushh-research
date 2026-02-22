"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pencil,
  Plus,
  Save,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { AssetAllocationDonut } from "@/components/kai/charts/asset-allocation-donut";
import { GainLossDistributionChart } from "@/components/kai/charts/gain-loss-distribution-chart";
import { HoldingsConcentrationChart } from "@/components/kai/charts/holdings-concentration-chart";
import { PortfolioHistoryChart } from "@/components/kai/charts/portfolio-history-chart";
import { SectorAllocationChart } from "@/components/kai/charts/sector-allocation-chart";
import { EditHoldingModal } from "@/components/kai/modals/edit-holding-modal";
import type { Holding as PortfolioHolding, PortfolioData } from "@/components/kai/types/portfolio";
import { ProfileBasedPicksList } from "@/components/kai/cards/profile-based-picks-list";
import { useCache, type PortfolioData as CachedPortfolioData } from "@/lib/cache/cache-context";
import { CacheSyncService } from "@/lib/cache/cache-sync-service";
import { Button as MorphyButton } from "@/lib/morphy-ux/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/morphy-ux/card";
import { Icon } from "@/lib/morphy-ux/ui";
import { KAI_EXPERIENCE_CONTRACT } from "@/lib/kai/experience-contract";
import { WorldModelService } from "@/lib/services/world-model-service";
import { cn } from "@/lib/utils";
import { useVault } from "@/lib/vault/vault-context";
import { mapPortfolioToDashboardViewModel } from "@/components/kai/views/dashboard-data-mapper";

interface DashboardMasterViewProps {
  userId: string;
  vaultOwnerToken: string;
  portfolioData: PortfolioData;
  onAnalyzeStock?: (symbol: string) => void;
  onReupload?: () => void;
}

type ManagedHolding = PortfolioHolding & { pending_delete?: boolean };

const ALLOCATION_COLOR_PALETTE = [
  "#2563eb",
  "#0ea5e9",
  "#14b8a6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

const FINANCIAL_INTENT_MAP = [
  "portfolio",
  "profile",
  "documents",
  "analysis_history",
  "runtime",
  "analysis.decisions",
] as const;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function DataQualityFallback({ title, detail }: { title: string; detail: string }) {
  return (
    <Card variant="none" effect="glass" className="h-full min-w-0 rounded-2xl">
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

function deriveRiskBucket(holdings: ManagedHolding[]): string {
  if (!holdings.length) return "unknown";
  const totalValue = holdings.reduce((sum, holding) => sum + (holding.market_value || 0), 0);
  if (totalValue <= 0) return "unknown";
  const largestHolding = holdings
    .slice()
    .sort((a, b) => (b.market_value || 0) - (a.market_value || 0))[0];
  const largestWeight = largestHolding ? ((largestHolding.market_value || 0) / totalValue) * 100 : 0;
  if (largestWeight >= 30) return "aggressive";
  if (largestWeight >= 15) return "moderate";
  return "conservative";
}

export function DashboardMasterView({
  userId,
  vaultOwnerToken,
  portfolioData,
  onAnalyzeStock,
  onReupload,
}: DashboardMasterViewProps) {
  const { vaultKey } = useVault();
  const { setPortfolioData: setCachePortfolioData } = useCache();

  const [holdingsDraft, setHoldingsDraft] = useState<ManagedHolding[]>([]);
  const [hasHoldingsChanges, setHasHoldingsChanges] = useState(false);
  const [isSavingHoldings, setIsSavingHoldings] = useState(false);
  const [editingHolding, setEditingHolding] = useState<ManagedHolding | null>(null);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newHoldingSymbol, setNewHoldingSymbol] = useState("");
  const [newHoldingQuantity, setNewHoldingQuantity] = useState("");
  const [newHoldingPrice, setNewHoldingPrice] = useState("");

  useEffect(() => {
    const sourceHoldings = (portfolioData.holdings || portfolioData.detailed_holdings || []) as PortfolioHolding[];
    setHoldingsDraft(
      sourceHoldings.map((holding) => ({
        ...holding,
        pending_delete: false,
      }))
    );
    setHasHoldingsChanges(false);
  }, [portfolioData]);

  const activeHoldings = useMemo(
    () =>
      holdingsDraft
        .filter((holding) => !holding.pending_delete)
        .map((holding) => {
          const { pending_delete: _pendingDelete, ...rest } = holding;
          return rest;
        }),
    [holdingsDraft]
  );

  const workingPortfolioData = useMemo<PortfolioData>(
    () => ({
      ...portfolioData,
      holdings: activeHoldings,
      detailed_holdings: activeHoldings,
    }),
    [activeHoldings, portfolioData]
  );

  const model = useMemo(
    () => mapPortfolioToDashboardViewModel(workingPortfolioData),
    [workingPortfolioData]
  );

  const allocationData = useMemo(
    () =>
      model.allocation.map((entry, index) => ({
        ...entry,
        color: ALLOCATION_COLOR_PALETTE[index % ALLOCATION_COLOR_PALETTE.length] ?? "#2563eb",
      })),
    [model.allocation]
  );

  const holdingSymbols = useMemo(
    () =>
      model.holdings
        .map((holding) => String(holding.symbol || "").trim().toUpperCase())
        .filter((symbol, idx, arr) => Boolean(symbol) && arr.indexOf(symbol) === idx)
        .slice(0, 20),
    [model.holdings]
  );

  const visibleHoldingRows = useMemo(
    () =>
      holdingsDraft
        .map((holding, index) => ({ holding, index }))
        .filter((row) => !row.holding.pending_delete)
        .slice(0, 8),
    [holdingsDraft]
  );

  const investorSnapshot = useMemo(() => {
    const totalValue = model.hero.totalValue || 0;
    const holdings = model.holdings || [];
    const losers = holdings.filter((holding) => (holding.unrealized_gain_loss || 0) < 0);
    const losersValue = losers.reduce((sum, holding) => sum + (holding.market_value || 0), 0);
    const winnersCount = holdings.filter((holding) => (holding.unrealized_gain_loss || 0) > 0).length;
    const uniqueSectors = new Set(
      holdings
        .map((holding) => String(holding.sector || holding.asset_type || "").trim())
        .filter((value) => value.length > 0)
    ).size;
    const top3ConcentrationPct =
      totalValue > 0
        ? model.concentration
            .slice(0, 3)
            .reduce((sum, row) => sum + row.weightPct, 0)
        : 0;
    const cashRow = model.allocation.find((row) => row.name.toLowerCase().includes("cash"));
    const fixedIncomeRow = model.allocation.find(
      (row) =>
        row.name.toLowerCase().includes("fixed income") ||
        row.name.toLowerCase().includes("bond")
    );
    const realAssetsRow = model.allocation.find(
      (row) =>
        row.name.toLowerCase().includes("real asset") ||
        row.name.toLowerCase().includes("real estate") ||
        row.name.toLowerCase().includes("commod")
    );
    const estimatedAnnualIncome = holdings.reduce(
      (sum, holding) => sum + (holding.estimated_annual_income || 0),
      0
    );
    const annualYieldPct =
      totalValue > 0 && estimatedAnnualIncome > 0
        ? (estimatedAnnualIncome / totalValue) * 100
        : 0;
    const optimizationPressurePct = totalValue > 0 ? (losersValue / totalValue) * 100 : 0;
    const readinessScore = Math.round(
      ((model.quality.sectorCoveragePct +
        model.quality.gainLossCoveragePct +
        (model.quality.allocationReady ? 1 : 0) +
        (model.quality.concentrationReady ? 1 : 0)) /
        4) *
        100
    );

    return {
      losersCount: losers.length,
      winnersCount,
      uniqueSectors,
      top3ConcentrationPct,
      cashPct: totalValue > 0 && cashRow ? (cashRow.value / totalValue) * 100 : 0,
      fixedIncomePct: totalValue > 0 && fixedIncomeRow ? (fixedIncomeRow.value / totalValue) * 100 : 0,
      realAssetsPct: totalValue > 0 && realAssetsRow ? (realAssetsRow.value / totalValue) * 100 : 0,
      estimatedAnnualIncome,
      annualYieldPct,
      optimizationPressurePct,
      readinessScore,
    };
  }, [model]);

  const closeHoldingModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingHolding(null);
    setEditingIndex(-1);
  }, []);

  const persistHoldingsChanges = useCallback(async () => {
    if (!userId || !vaultKey) {
      toast.error("Unlock your vault to save holdings.");
      return;
    }

    setIsSavingHoldings(true);
    try {
      const holdingsForSave = activeHoldings;
      const cashBalance = Number(
        portfolioData.account_summary?.cash_balance ?? portfolioData.cash_balance ?? 0
      );
      const equitiesValue = holdingsForSave.reduce((sum, holding) => sum + (holding.market_value || 0), 0);
      const endingValue = equitiesValue + cashBalance;

      const updatedPortfolioData: PortfolioData = {
        ...portfolioData,
        holdings: holdingsForSave,
        detailed_holdings: holdingsForSave,
        account_summary: {
          ...portfolioData.account_summary,
          ending_value: endingValue,
          equities_value: equitiesValue,
          cash_balance: cashBalance,
        },
        total_value: endingValue,
        cash_balance: cashBalance,
      };

      const nowIso = new Date().toISOString();
      const fullBlob = await WorldModelService.loadFullBlob({
        userId,
        vaultKey,
        vaultOwnerToken: vaultOwnerToken || undefined,
      }).catch(() => ({} as Record<string, unknown>));

      const existingFinancialRaw = fullBlob.financial;
      const existingFinancial =
        existingFinancialRaw &&
        typeof existingFinancialRaw === "object" &&
        !Array.isArray(existingFinancialRaw)
          ? ({ ...(existingFinancialRaw as Record<string, unknown>) } as Record<string, unknown>)
          : {};

      const nextFinancialDomain = {
        ...existingFinancial,
        ...updatedPortfolioData,
        schema_version: 3,
        domain_intent: {
          primary: "financial",
          source: "domain_registry_prepopulate",
          contract_version: 1,
          updated_at: nowIso,
        },
        portfolio: {
          ...updatedPortfolioData,
          domain_intent: {
            primary: "financial",
            secondary: "portfolio",
            source: "kai_dashboard_holdings",
            captured_sections: ["account_info", "account_summary", "holdings", "transactions"],
            updated_at: nowIso,
          },
        },
        updated_at: nowIso,
      };

      const riskBucket = deriveRiskBucket(holdingsForSave as ManagedHolding[]);
      const result = await WorldModelService.storeMergedDomain({
        userId,
        vaultKey,
        domain: "financial",
        domainData: nextFinancialDomain as unknown as Record<string, unknown>,
        summary: {
          intent_source: "kai_dashboard_holdings",
          has_portfolio: true,
          holdings_count: holdingsForSave.length,
          total_value: endingValue,
          portfolio_risk_bucket: riskBucket,
          risk_bucket: riskBucket,
          domain_contract_version: 1,
          intent_map: [...FINANCIAL_INTENT_MAP],
          last_updated: nowIso,
        },
        vaultOwnerToken: vaultOwnerToken || undefined,
      });

      if (!result.success) {
        throw new Error("Failed to save holdings");
      }

      setCachePortfolioData(userId, updatedPortfolioData as CachedPortfolioData);
      CacheSyncService.onPortfolioUpserted(userId, updatedPortfolioData as CachedPortfolioData);
      setHasHoldingsChanges(false);
      toast.success("Holdings updated");
    } catch (error) {
      console.error("[DashboardMasterView] Failed to save holdings:", error);
      toast.error("Failed to save holdings");
    } finally {
      setIsSavingHoldings(false);
    }
  }, [activeHoldings, portfolioData, setCachePortfolioData, userId, vaultKey, vaultOwnerToken]);

  const handleEditHolding = useCallback(
    (index: number) => {
      const row = holdingsDraft[index];
      if (!row) return;
      setEditingHolding({ ...row, pending_delete: false });
      setEditingIndex(index);
      setIsModalOpen(true);
    },
    [holdingsDraft]
  );

  const handleSaveHolding = useCallback(
    (updatedHolding: PortfolioHolding) => {
      setHoldingsDraft((prev) => {
        const next = [...prev];
        if (editingIndex >= 0 && editingIndex < next.length) {
          next[editingIndex] = { ...updatedHolding, pending_delete: false };
        } else {
          next.push({ ...updatedHolding, pending_delete: false });
        }
        return next;
      });
      setHasHoldingsChanges(true);
      closeHoldingModal();
    },
    [closeHoldingModal, editingIndex]
  );

  const handleDeleteHolding = useCallback((index: number) => {
    setHoldingsDraft((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
    setHasHoldingsChanges(true);
  }, []);

  const clearNewHoldingForm = useCallback(() => {
    setNewHoldingSymbol("");
    setNewHoldingQuantity("");
    setNewHoldingPrice("");
  }, []);

  const handleAddHoldingFromEntry = useCallback(() => {
    const symbol = newHoldingSymbol.trim().toUpperCase();
    const quantity = Number(newHoldingQuantity);
    const price = Number(newHoldingPrice);

    if (!symbol || !/^[A-Z][A-Z0-9.-]{0,5}$/.test(symbol)) {
      toast.error("Enter a valid stock ticker.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Enter a valid share quantity.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Enter a valid average price.");
      return;
    }

    const marketValue = quantity * price;
    const newHolding: ManagedHolding = {
      symbol,
      name: symbol,
      quantity,
      price,
      market_value: marketValue,
      cost_basis: marketValue,
      unrealized_gain_loss: 0,
      unrealized_gain_loss_pct: 0,
      pending_delete: false,
    };

    setHoldingsDraft((prev) => [...prev, newHolding]);
    setHasHoldingsChanges(true);
    clearNewHoldingForm();
  }, [clearNewHoldingForm, newHoldingPrice, newHoldingQuantity, newHoldingSymbol]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-5 pb-[calc(160px+var(--app-bottom-inset))] pt-4 sm:px-8">
      <Card
        variant="muted"
        effect="fill"
        className="overflow-hidden rounded-[26px] p-0 !border-transparent shadow-[0_14px_44px_rgba(15,23,42,0.06)]"
      >
        <CardContent className="space-y-6 p-6 sm:p-7">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm font-medium text-muted-foreground">Total portfolio value</p>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="inline-flex items-center rounded-full bg-background px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Risk: {model.hero.portfolioConcentrationLabel.replace(" Concentration", "")}
              </span>
              <span className="inline-flex items-center rounded-full bg-background px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Holdings: {model.hero.holdingsCount}
              </span>
            </div>
            <p className="text-4xl font-black tracking-tight">{formatCurrency(model.hero.totalValue)}</p>
            <div className="flex items-center justify-center gap-2 text-sm">
              <span
                className={cn(
                  "inline-flex items-center font-semibold",
                  model.hero.netChange >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                )}
              >
                <Icon icon={model.hero.netChange >= 0 ? TrendingUp : TrendingDown} size="sm" className="mr-1" />
                {model.hero.netChange >= 0 ? "+" : ""}
                {formatCurrency(model.hero.netChange)} ({model.hero.changePct.toFixed(2)}%)
              </span>
              {model.hero.statementPeriod ? (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{model.hero.statementPeriod}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/75 p-4 text-center">
            <p className="text-sm font-semibold">{model.hero.statementPeriod || "Current statement period"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Beginning Balance:{" "}
              <span className="font-semibold text-foreground">{formatCurrency(model.hero.beginningValue)}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h3 className="px-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Sector Allocation
        </h3>
        {model.quality.sectorReady ? (
          <SectorAllocationChart
            className="min-w-0 overflow-hidden rounded-[22px]"
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
      </section>

      <Card
        variant="muted"
        effect="fill"
        className="rounded-[24px] p-0 !border-transparent shadow-[0_12px_36px_rgba(15,23,42,0.05)]"
      >
        <CardHeader className="pb-2 px-6 pt-6 sm:px-7">
          <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
            Investor Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-6 pb-6 pt-0 sm:px-7 sm:pb-7">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-background/75 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Debate Readiness
              </p>
              <p className="mt-1 text-2xl font-black">{investorSnapshot.readinessScore}</p>
              <p className="text-xs text-muted-foreground">Context quality score (0-100)</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/75 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Optimization Pressure
              </p>
              <p className="mt-1 text-2xl font-black">{formatPercent(investorSnapshot.optimizationPressurePct)}</p>
              <p className="text-xs text-muted-foreground">
                Portfolio value in losing positions
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/75 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Top 3 Concentration
              </p>
              <p className="mt-1 text-2xl font-black">{formatPercent(investorSnapshot.top3ConcentrationPct)}</p>
              <p className="text-xs text-muted-foreground">
                Largest three holdings share
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/75 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Estimated Annual Income
              </p>
              <p className="mt-1 text-2xl font-black">{formatCurrency(investorSnapshot.estimatedAnnualIncome)}</p>
              <p className="text-xs text-muted-foreground">
                Yield {formatPercent(investorSnapshot.annualYieldPct)}
              </p>
            </div>
          </div>

          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
              {investorSnapshot.losersCount} losers / {investorSnapshot.winnersCount} winners
            </div>
            <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
              {investorSnapshot.uniqueSectors} sector buckets represented
            </div>
            <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
              Cash allocation {formatPercent(investorSnapshot.cashPct)}
            </div>
            <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
              Fixed income {formatPercent(investorSnapshot.fixedIncomePct)} / Real assets{" "}
              {formatPercent(investorSnapshot.realAssetsPct)}
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h3 className="px-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Portfolio Insights
        </h3>
        <div className="grid gap-4 lg:grid-cols-2">
          {model.quality.allocationReady ? (
            <Card variant="none" effect="glass" className="min-w-0 overflow-hidden rounded-[22px]">
              <CardHeader className="pb-2 px-5 pt-5">
                <CardTitle className="text-sm">Allocation Mix</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0">
                <AssetAllocationDonut data={allocationData} height={240} />
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
              className="h-full min-w-0 overflow-hidden rounded-[22px]"
            />
          ) : (
            <DataQualityFallback
              title="Portfolio History"
              detail="Insufficient statement period values to plot a defensible history trend."
            />
          )}

          {model.quality.gainLossReady ? (
            <GainLossDistributionChart
              className="min-w-0 overflow-hidden rounded-[22px]"
              data={model.gainLossDistribution}
            />
          ) : (
            <DataQualityFallback
              title="Gain/Loss Distribution"
              detail="Statement lacks enough gain/loss percentages to build a reliable distribution."
            />
          )}

          {model.quality.concentrationReady ? (
            <HoldingsConcentrationChart
              className="min-w-0 overflow-hidden rounded-[22px]"
              data={model.concentration}
            />
          ) : (
            <DataQualityFallback
              title="Holdings Concentration"
              detail="Need at least three measurable holdings to compute concentration safely."
            />
          )}
        </div>
      </section>

      <Card
        variant="muted"
        effect="fill"
        className="min-w-0 rounded-[24px] p-0 !border-transparent shadow-[0_12px_36px_rgba(15,23,42,0.05)]"
      >
        <CardHeader className="pb-2 px-6 pt-6 sm:px-7">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
              Current Holdings
            </CardTitle>
            <MorphyButton
              variant="none"
              effect="fade"
              size="sm"
              onClick={() => {
                setEditingHolding({
                  symbol: "",
                  name: "",
                  quantity: 0,
                  price: 0,
                  market_value: 0,
                  pending_delete: false,
                });
                setEditingIndex(-1);
                setIsModalOpen(true);
              }}
            >
              <Icon icon={Plus} size="sm" className="mr-1" />
              Add Holding
            </MorphyButton>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 px-6 pb-6 pt-0 sm:px-7 sm:pb-7">
          {visibleHoldingRows.map(({ holding, index }) => (
            <div key={`${holding.symbol}-${index}`} className="rounded-xl border border-border/50 bg-background/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-xs font-black">
                    {holding.symbol.slice(0, 4)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold leading-tight">{holding.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{holding.symbol}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <MorphyButton
                    variant="none"
                    effect="fade"
                    size="icon-sm"
                    aria-label={`Edit ${holding.symbol}`}
                    onClick={() => handleEditHolding(index)}
                  >
                    <Icon icon={Pencil} size="sm" />
                  </MorphyButton>
                  <MorphyButton
                    variant="none"
                    effect="fade"
                    size="icon-sm"
                    aria-label={`Delete ${holding.symbol}`}
                    onClick={() => handleDeleteHolding(index)}
                    className="text-rose-500 hover:text-rose-600"
                  >
                    <Icon icon={Trash2} size="sm" />
                  </MorphyButton>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="uppercase tracking-wide text-muted-foreground">Shares @ Price</p>
                  <p className="mt-1 text-sm font-medium">
                    {holding.quantity.toLocaleString()} @ {formatCurrency(holding.price)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="uppercase tracking-wide text-muted-foreground">Market Value</p>
                  <p className="mt-1 text-sm font-bold">{formatCurrency(holding.market_value)}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wide text-muted-foreground">Gain/Loss</p>
                  <p
                    className={cn(
                      "mt-1 text-sm font-medium",
                      (holding.unrealized_gain_loss || 0) >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {(holding.unrealized_gain_loss || 0) >= 0 ? "+" : ""}
                    {formatCurrency(holding.unrealized_gain_loss || 0)}
                  </p>
                </div>
                <div className="flex items-end justify-end">
                  <MorphyButton
                    variant="none"
                    effect="fade"
                    size="sm"
                    onClick={() => onAnalyzeStock?.(holding.symbol)}
                  >
                    Connect Kai
                  </MorphyButton>
                </div>
              </div>
            </div>
          ))}

          {visibleHoldingRows.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
              No holdings were found in this statement yet.
            </div>
          ) : null}

          <div className="rounded-xl border border-border/60 bg-background/70 p-4">
            <p className="mb-4 text-sm font-semibold">New Holding Entry</p>
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Stock Ticker
                </p>
                <input
                  type="text"
                  value={newHoldingSymbol}
                  onChange={(event) => setNewHoldingSymbol(event.target.value.toUpperCase())}
                  placeholder="e.g. AAPL"
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Shares
                  </p>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={newHoldingQuantity}
                    onChange={(event) => setNewHoldingQuantity(event.target.value)}
                    placeholder="0"
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary"
                  />
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Average Price
                  </p>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newHoldingPrice}
                    onChange={(event) => setNewHoldingPrice(event.target.value)}
                    placeholder="0.00"
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <MorphyButton variant="none" effect="fade" fullWidth onClick={clearNewHoldingForm}>
                  Undo
                </MorphyButton>
                <MorphyButton
                  variant="none"
                  effect="fill"
                  fullWidth
                  onClick={handleAddHoldingFromEntry}
                  className="bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-700)] dark:bg-white dark:text-black dark:hover:bg-white/90"
                >
                  Add
                </MorphyButton>
              </div>
            </div>
          </div>

          {hasHoldingsChanges ? (
            <div className="pt-2">
              <MorphyButton
                variant="none"
                effect="fill"
                fullWidth
                onClick={() => void persistHoldingsChanges()}
                disabled={isSavingHoldings}
                className="bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
              >
                <Icon icon={Save} size="sm" className="mr-2" />
                {isSavingHoldings ? "Saving Holdings..." : "Save Holdings Changes"}
              </MorphyButton>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card variant="none" effect="glass" className="min-w-0 overflow-hidden rounded-[24px]">
        <CardContent className="p-5 sm:p-6">
          <ProfileBasedPicksList
            userId={userId}
            vaultOwnerToken={vaultOwnerToken}
            symbols={holdingSymbols}
            onAdd={(symbol) => onAnalyzeStock?.(symbol)}
          />
        </CardContent>
      </Card>

      <Card variant="none" effect="glass" className="min-w-0 overflow-hidden rounded-[24px]">
        <CardHeader className="pb-2 px-5 pt-5 sm:px-6 sm:pt-6">
          <CardTitle className="text-sm">Recommendations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-5 pb-5 pt-0 sm:px-6 sm:pb-6">
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

      <Card variant="none" effect="glass" className="rounded-[24px]">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5 text-xs text-muted-foreground sm:p-6">
          <p>Imported statement data is synced across dashboard and holdings views.</p>
          <MorphyButton variant="none" effect="fade" size="sm" onClick={onReupload}>
            Import New Statement
          </MorphyButton>
        </CardContent>
      </Card>

      <EditHoldingModal
        isOpen={isModalOpen}
        onClose={closeHoldingModal}
        holding={editingHolding}
        onSave={handleSaveHolding}
      />
    </div>
  );
}
