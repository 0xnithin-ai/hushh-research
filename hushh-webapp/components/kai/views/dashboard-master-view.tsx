"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Plus,
  Save,
  Trash2,
  TrendingDown,
  TrendingUp,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/app-ui/data-table";
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
import { ROUTES } from "@/lib/navigation/routes";
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

type ManagedHolding = PortfolioHolding & {
  pending_delete?: boolean;
  client_id: string;
  source_key?: string;
};

interface ComparableHolding {
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  market_value: number;
  cost_basis: number;
  acquisition_date: string;
}

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

function toComparableHolding(holding: Partial<PortfolioHolding>): ComparableHolding {
  return {
    symbol: String(holding.symbol || "").trim().toUpperCase(),
    name: String(holding.name || "").trim(),
    quantity: Number.isFinite(Number(holding.quantity)) ? Number(holding.quantity) : 0,
    price: Number.isFinite(Number(holding.price)) ? Number(holding.price) : 0,
    market_value: Number.isFinite(Number(holding.market_value)) ? Number(holding.market_value) : 0,
    cost_basis: Number.isFinite(Number(holding.cost_basis)) ? Number(holding.cost_basis) : 0,
    acquisition_date: String(holding.acquisition_date || "").trim(),
  };
}

function comparableHoldingsEqual(a: ComparableHolding, b: ComparableHolding): boolean {
  return (
    a.symbol === b.symbol &&
    a.name === b.name &&
    Math.abs(a.quantity - b.quantity) < 0.0001 &&
    Math.abs(a.price - b.price) < 0.0001 &&
    Math.abs(a.market_value - b.market_value) < 0.01 &&
    Math.abs(a.cost_basis - b.cost_basis) < 0.01 &&
    a.acquisition_date === b.acquisition_date
  );
}

function createLocalHoldingId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildManagedHoldingsFromSource(sourceHoldings: PortfolioHolding[]): {
  managed: ManagedHolding[];
  baselineBySource: Map<string, ComparableHolding>;
} {
  const baselineBySource = new Map<string, ComparableHolding>();
  const managed = sourceHoldings.map((holding, index) => {
    const sourceKey = `source-${index}`;
    baselineBySource.set(sourceKey, toComparableHolding(holding));
    return {
      ...holding,
      pending_delete: false,
      client_id: sourceKey,
      source_key: sourceKey,
    };
  });
  return { managed, baselineBySource };
}

export function DashboardMasterView({
  userId,
  vaultOwnerToken,
  portfolioData,
  onAnalyzeStock,
  onReupload,
}: DashboardMasterViewProps) {
  const router = useRouter();
  const { vaultKey } = useVault();
  const { setPortfolioData: setCachePortfolioData } = useCache();
  const baselineBySourceRef = useRef<Map<string, ComparableHolding>>(new Map());

  const [holdingsDraft, setHoldingsDraft] = useState<ManagedHolding[]>([]);
  const [isSavingHoldings, setIsSavingHoldings] = useState(false);
  const [editingHolding, setEditingHolding] = useState<ManagedHolding | null>(null);
  const [editingHoldingId, setEditingHoldingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const sourceHoldings = (portfolioData.holdings || portfolioData.detailed_holdings || []) as PortfolioHolding[];
    const { managed, baselineBySource } = buildManagedHoldingsFromSource(sourceHoldings);
    baselineBySourceRef.current = baselineBySource;
    setHoldingsDraft(managed);
  }, [portfolioData]);

  const activeHoldings = useMemo(
    () =>
      holdingsDraft
        .filter((holding) => !holding.pending_delete)
        .map((holding) => {
          const {
            pending_delete: _pendingDelete,
            client_id: _clientId,
            source_key: _sourceKey,
            ...rest
          } = holding;
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

  const holdingsChangeSummary = useMemo(() => {
    const baselineBySource = baselineBySourceRef.current;
    let added = 0;
    let edited = 0;
    let deleted = 0;

    for (const holding of holdingsDraft) {
      const baseline = holding.source_key ? baselineBySource.get(holding.source_key) : undefined;

      if (!baseline) {
        if (!holding.pending_delete) {
          added += 1;
        }
        continue;
      }

      if (holding.pending_delete) {
        deleted += 1;
        continue;
      }

      const currentComparable = toComparableHolding(holding);
      if (!comparableHoldingsEqual(currentComparable, baseline)) {
        edited += 1;
      }
    }

    return {
      added,
      edited,
      deleted,
      total: added + edited + deleted,
    };
  }, [holdingsDraft]);

  const hasHoldingsChanges = holdingsChangeSummary.total > 0;

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
    setEditingHoldingId(null);
  }, []);

  const openAddHoldingModal = useCallback(() => {
    setEditingHolding({
      symbol: "",
      name: "",
      quantity: 0,
      price: 0,
      market_value: 0,
      pending_delete: false,
      client_id: createLocalHoldingId(),
    });
    setEditingHoldingId(null);
    setIsModalOpen(true);
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
      const { managed, baselineBySource } = buildManagedHoldingsFromSource(holdingsForSave);
      baselineBySourceRef.current = baselineBySource;
      setHoldingsDraft(managed);
      toast.success("Holdings updated");
    } catch (error) {
      console.error("[DashboardMasterView] Failed to save holdings:", error);
      toast.error("Failed to save holdings");
    } finally {
      setIsSavingHoldings(false);
    }
  }, [activeHoldings, portfolioData, setCachePortfolioData, userId, vaultKey, vaultOwnerToken]);

  const handleEditHolding = useCallback(
    (holdingId: string) => {
      const row = holdingsDraft.find((holding) => holding.client_id === holdingId);
      if (!row) return;
      if (row.pending_delete) {
        toast.info("Restore this holding before editing.");
        return;
      }
      setEditingHolding({ ...row, pending_delete: false });
      setEditingHoldingId(holdingId);
      setIsModalOpen(true);
    },
    [holdingsDraft]
  );

  const handleSaveHolding = useCallback(
    (updatedHolding: PortfolioHolding) => {
      setHoldingsDraft((prev) => {
        const next = [...prev];
        const targetIndex = editingHoldingId
          ? next.findIndex((holding) => holding.client_id === editingHoldingId)
          : -1;

        if (targetIndex >= 0) {
          const existing = next[targetIndex];
          if (!existing) return next;
          next[targetIndex] = {
            ...existing,
            ...updatedHolding,
            pending_delete: false,
            client_id: existing.client_id,
            source_key: existing.source_key,
          };
        } else {
          next.push({
            ...updatedHolding,
            pending_delete: false,
            client_id: createLocalHoldingId(),
          });
        }
        return next;
      });
      closeHoldingModal();
    },
    [closeHoldingModal, editingHoldingId]
  );

  const handleToggleDeleteHolding = useCallback((holdingId: string) => {
    setHoldingsDraft((prev) =>
      prev.map((holding) =>
        holding.client_id === holdingId
          ? { ...holding, pending_delete: !holding.pending_delete }
          : holding
      )
    );
  }, []);

  const holdingsTableColumns = useMemo<ColumnDef<ManagedHolding>[]>(
    () => [
      {
        accessorKey: "symbol",
        header: "Holding",
        cell: ({ row }) => {
          const holding = row.original;
          const deleted = Boolean(holding.pending_delete);
          return (
            <div className={cn("min-w-0", deleted && "opacity-60")}>
              <p className={cn("font-semibold", deleted && "line-through")}>
                {holding.symbol || "—"}
              </p>
              <p className={cn("truncate text-xs text-muted-foreground", deleted && "line-through")}>
                {holding.name || "Unnamed security"}
              </p>
            </div>
          );
        },
      },
      {
        id: "position",
        header: "Shares @ Price",
        cell: ({ row }) => {
          const holding = row.original;
          return (
            <span className={cn("text-sm", holding.pending_delete && "line-through text-muted-foreground")}>
              {Number(holding.quantity || 0).toLocaleString()} @ {formatCurrency(Number(holding.price || 0))}
            </span>
          );
        },
      },
      {
        accessorKey: "market_value",
        header: "Market Value",
        cell: ({ row }) => {
          const holding = row.original;
          return (
            <span className={cn("font-semibold", holding.pending_delete && "line-through text-muted-foreground")}>
              {formatCurrency(Number(holding.market_value || 0))}
            </span>
          );
        },
      },
      {
        accessorKey: "unrealized_gain_loss",
        header: "Gain / Loss",
        cell: ({ row }) => {
          const holding = row.original;
          const gain = Number(holding.unrealized_gain_loss || 0);
          const gainText = `${gain >= 0 ? "+" : ""}${formatCurrency(gain)}`;
          return (
            <span
              className={cn(
                "font-medium",
                holding.pending_delete
                  ? "line-through text-muted-foreground"
                  : gain >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
              )}
            >
              {gainText}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const holding = row.original;
          const isDeleted = Boolean(holding.pending_delete);
          return (
            <div className="flex flex-wrap items-center justify-end gap-1">
              <MorphyButton
                variant="none"
                effect="fade"
                size="icon-sm"
                disabled={isDeleted}
                aria-label={`Edit ${holding.symbol || "holding"}`}
                onClick={() => handleEditHolding(holding.client_id)}
              >
                <Icon icon={Pencil} size="sm" />
              </MorphyButton>
              <MorphyButton
                variant="none"
                effect="fade"
                size="sm"
                aria-label={isDeleted ? `Undo remove ${holding.symbol}` : `Remove ${holding.symbol}`}
                onClick={() => handleToggleDeleteHolding(holding.client_id)}
                className={cn(
                  "min-w-[78px]",
                  isDeleted ? "text-muted-foreground" : "text-rose-600 hover:text-rose-700"
                )}
              >
                <Icon icon={isDeleted ? Undo2 : Trash2} size="sm" className="mr-1" />
                {isDeleted ? "Restore" : "Remove"}
              </MorphyButton>
              <MorphyButton
                variant="none"
                effect="fade"
                size="sm"
                disabled={isDeleted}
                onClick={() => onAnalyzeStock?.(holding.symbol)}
              >
                Analyze
              </MorphyButton>
            </div>
          );
        },
      },
    ],
    [handleEditHolding, handleToggleDeleteHolding, onAnalyzeStock]
  );

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
              onClick={openAddHoldingModal}
            >
              <Icon icon={Plus} size="sm" className="mr-1" />
              Add Holding
            </MorphyButton>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 px-6 pb-6 pt-0 sm:px-7 sm:pb-7">
          <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2.5 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">Change Summary</span>
              <span className="rounded-full bg-background px-2 py-0.5">Added: {holdingsChangeSummary.added}</span>
              <span className="rounded-full bg-background px-2 py-0.5">Edited: {holdingsChangeSummary.edited}</span>
              <span className="rounded-full bg-background px-2 py-0.5">Deleted: {holdingsChangeSummary.deleted}</span>
            </div>
          </div>

          <div className="sm:hidden space-y-3">
            {holdingsDraft.length === 0 ? (
              <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                No holdings were found in this statement yet.
              </div>
            ) : (
              holdingsDraft.map((holding) => {
                const isDeleted = Boolean(holding.pending_delete);
                const gainValue = Number(holding.unrealized_gain_loss || 0);
                return (
                  <div
                    key={holding.client_id}
                    className={cn(
                      "rounded-xl border border-border/50 bg-background/80 p-3",
                      isDeleted && "bg-muted/45 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <MorphyButton
                          variant="none"
                          effect="fade"
                          size="icon-sm"
                          disabled={isDeleted}
                          aria-label={`Edit ${holding.symbol || "holding"}`}
                          onClick={() => handleEditHolding(holding.client_id)}
                        >
                          <Icon icon={Pencil} size="sm" />
                        </MorphyButton>
                        <MorphyButton
                          variant="none"
                          effect="fade"
                          size="icon-sm"
                          aria-label={isDeleted ? `Restore ${holding.symbol}` : `Delete ${holding.symbol}`}
                          onClick={() => handleToggleDeleteHolding(holding.client_id)}
                          className={cn(
                            isDeleted
                              ? "text-muted-foreground"
                              : "text-rose-600 hover:text-rose-700"
                          )}
                        >
                          <Icon icon={isDeleted ? Undo2 : Trash2} size="sm" />
                        </MorphyButton>
                      </div>
                      <MorphyButton
                        variant="none"
                        effect="fade"
                        size="sm"
                        disabled={isDeleted}
                        onClick={() => onAnalyzeStock?.(holding.symbol)}
                      >
                        Analyze
                      </MorphyButton>
                    </div>

                    <div className="mt-2 min-w-0">
                      <p className={cn("text-sm font-semibold", isDeleted && "line-through")}>
                        {holding.symbol || "—"}
                      </p>
                      <p className={cn("truncate text-xs text-muted-foreground", isDeleted && "line-through")}>
                        {holding.name || "Unnamed security"}
                      </p>
                      {isDeleted ? (
                        <span className="mt-1 inline-flex rounded-full bg-background px-2 py-0.5 text-[10px] uppercase tracking-wide">
                          Marked for removal
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Shares @ Price</p>
                        <p className={cn("font-medium", isDeleted && "line-through")}>
                          {Number(holding.quantity || 0).toLocaleString()} @ {formatCurrency(Number(holding.price || 0))}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Market Value</p>
                        <p className={cn("font-semibold", isDeleted && "line-through")}>
                          {formatCurrency(Number(holding.market_value || 0))}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Gain / Loss</p>
                        <p
                          className={cn(
                            "font-medium",
                            isDeleted
                              ? "line-through text-muted-foreground"
                              : gainValue >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                          )}
                        >
                          {gainValue >= 0 ? "+" : ""}
                          {formatCurrency(gainValue)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden sm:block">
            <DataTable
              columns={holdingsTableColumns}
              data={holdingsDraft}
              searchPlaceholder="Search holdings by symbol or name..."
              initialPageSize={5}
              pageSizeOptions={[5, 10, 20]}
              rowClassName={(holding) =>
                holding.pending_delete
                  ? "bg-muted/45 text-muted-foreground"
                  : "bg-transparent"
              }
            />
          </div>

          {hasHoldingsChanges ? (
            <div className="pt-2">
              <MorphyButton
                variant="blue-gradient"
                effect="fade"
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
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm">Recommendations</CardTitle>
            <MorphyButton
              variant="none"
              effect="fade"
              size="sm"
              onClick={() => router.push(ROUTES.KAI_OPTIMIZE)}
            >
              Optimize
            </MorphyButton>
          </div>
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
