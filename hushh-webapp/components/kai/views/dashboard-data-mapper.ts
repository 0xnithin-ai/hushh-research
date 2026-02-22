import type { Holding, PortfolioData } from "@/components/kai/types/portfolio";

export interface AllocationDatum {
  name: string;
  value: number;
  color: string;
}

export interface HistoryDatum {
  date: string;
  value: number;
}

export interface ConcentrationDatum {
  symbol: string;
  name: string;
  marketValue: number;
  weightPct: number;
}

export interface GainLossBandDatum {
  band: string;
  count: number;
}

export interface DashboardRecommendation {
  title: string;
  detail: string;
}

export interface DashboardHeroData {
  totalValue: number;
  beginningValue: number;
  endingValue: number;
  netChange: number;
  changePct: number;
  holdingsCount: number;
  portfolioConcentrationLabel: string;
  statementPeriod?: string;
}

export interface DashboardQualityFlags {
  allocationReady: boolean;
  sectorReady: boolean;
  historyReady: boolean;
  concentrationReady: boolean;
  gainLossReady: boolean;
  sectorCoveragePct: number;
  gainLossCoveragePct: number;
}

export interface DashboardViewModel {
  hero: DashboardHeroData;
  holdings: Holding[];
  allocation: AllocationDatum[];
  history: HistoryDatum[];
  concentration: ConcentrationDatum[];
  gainLossDistribution: GainLossBandDatum[];
  recommendations: DashboardRecommendation[];
  sourceBrokerage?: string;
  quality: DashboardQualityFlags;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,%\s,]/g, "").trim();
    if (!cleaned) return undefined;
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toSafeHolding(raw: Holding): Holding | null {
  const symbol = String(raw.symbol || "").trim().toUpperCase();
  if (!symbol) return null;
  const marketValue = toNumber(raw.market_value) ?? 0;
  const sector =
    typeof raw.sector === "string" && raw.sector.trim().length > 0
      ? raw.sector.trim()
      : undefined;
  const assetType =
    typeof raw.asset_type === "string" && raw.asset_type.trim().length > 0
      ? raw.asset_type.trim()
      : undefined;

  return {
    ...raw,
    symbol,
    name: String(raw.name || symbol),
    quantity: toNumber(raw.quantity) ?? 0,
    price: toNumber(raw.price) ?? 0,
    market_value: marketValue,
    cost_basis: toNumber(raw.cost_basis),
    unrealized_gain_loss: toNumber(raw.unrealized_gain_loss),
    unrealized_gain_loss_pct: toNumber(raw.unrealized_gain_loss_pct),
    sector,
    asset_type: assetType,
  };
}

function formatStatementPeriod(data: PortfolioData): string | undefined {
  const start = data.account_info?.statement_period_start;
  const end = data.account_info?.statement_period_end;
  if (!start || !end) return undefined;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`;
  } catch {
    return undefined;
  }
}

function derivePortfolioConcentrationLabel(holdings: Holding[]): string {
  if (!holdings.length) return "Unknown";
  const concentration = holdings
    .map((holding) => toNumber(holding.market_value) ?? 0)
    .sort((a, b) => b - a);
  const total = concentration.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return "Unknown";
  const largestWeight = concentration[0] ? (concentration[0] / total) * 100 : 0;
  if (largestWeight >= 40) return "High Concentration";
  if (largestWeight >= 25) return "Medium Concentration";
  return "Diversified";
}

function computeAllocationFromAssetTypes(
  holdings: Holding[],
  totalValue: number
): AllocationDatum[] {
  const grouped = new Map<string, number>();
  for (const holding of holdings) {
    const bucket = (holding.asset_type || holding.asset_class || "Other")
      .toString()
      .trim();
    const key = bucket.length > 0 ? bucket : "Other";
    grouped.set(key, (grouped.get(key) || 0) + (toNumber(holding.market_value) ?? 0));
  }

  return Array.from(grouped.entries())
    .map(([name, value], index) => ({
      name,
      value,
      color: `var(--chart-${(index % 5) + 1})`,
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((row) => ({
      ...row,
      value: totalValue > 0 ? row.value : 0,
    }));
}

function computeAllocation(data: PortfolioData, holdings: Holding[], totalValue: number): AllocationDatum[] {
  const allocation = data.asset_allocation;
  if (allocation && !Array.isArray(allocation)) {
    const cashPct = toNumber(allocation.cash_pct ?? allocation.cash_percent) ?? 0;
    const equitiesPct = toNumber(allocation.equities_pct ?? allocation.equities_percent) ?? 0;
    const bondsPct = toNumber(allocation.bonds_pct ?? allocation.bonds_percent) ?? 0;
    const otherPct = toNumber(allocation.other_percent) ?? Math.max(0, 100 - cashPct - equitiesPct - bondsPct);

    const fromPct: AllocationDatum[] = [
      { name: "Equities", value: (equitiesPct / 100) * totalValue, color: "var(--chart-2)" },
      { name: "Cash", value: (cashPct / 100) * totalValue, color: "var(--chart-1)" },
      { name: "Bonds", value: (bondsPct / 100) * totalValue, color: "var(--chart-4)" },
      { name: "Other", value: (otherPct / 100) * totalValue, color: "var(--chart-3)" },
    ].filter((row) => row.value > 0);

    if (fromPct.length > 0) {
      return fromPct;
    }
  }

  return computeAllocationFromAssetTypes(holdings, totalValue);
}

function computeHistory(data: PortfolioData, beginningValue: number, endingValue: number): HistoryDatum[] {
  const raw = Array.isArray(data.historical_values) ? data.historical_values : [];
  const mapped = raw
    .map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return null;
      const entry = row as Record<string, unknown>;
      const date =
        (typeof entry.date === "string" && entry.date) ||
        (typeof entry.as_of === "string" && entry.as_of) ||
        (typeof entry.period === "string" && entry.period) ||
        "";
      const value =
        toNumber(entry.value) ??
        toNumber(entry.portfolio_value) ??
        toNumber(entry.total_value) ??
        toNumber(entry.ending_value);
      if (!date || value === undefined) return null;
      return { date, value };
    })
    .filter((row): row is HistoryDatum => Boolean(row));

  if (mapped.length >= 2) {
    return mapped;
  }

  if (beginningValue > 0 || endingValue > 0) {
    const startLabel = data.account_info?.statement_period_start || "Start";
    const endLabel = data.account_info?.statement_period_end || "End";
    return [
      { date: startLabel, value: beginningValue || endingValue },
      { date: endLabel, value: endingValue || beginningValue },
    ];
  }

  return [];
}

function computeConcentration(holdings: Holding[], totalValue: number): ConcentrationDatum[] {
  return holdings
    .map((holding) => {
      const marketValue = toNumber(holding.market_value) ?? 0;
      return {
        symbol: holding.symbol,
        name: holding.name || holding.symbol,
        marketValue,
        weightPct: totalValue > 0 ? (marketValue / totalValue) * 100 : 0,
      };
    })
    .filter((row) => row.marketValue > 0)
    .sort((a, b) => b.marketValue - a.marketValue)
    .slice(0, 8);
}

function computeGainLossDistribution(holdings: Holding[]): GainLossBandDatum[] {
  const bands = [
    { band: "< -10%", min: Number.NEGATIVE_INFINITY, max: -10, count: 0 },
    { band: "-10% to -2%", min: -10, max: -2, count: 0 },
    { band: "-2% to +2%", min: -2, max: 2, count: 0 },
    { band: "+2% to +10%", min: 2, max: 10, count: 0 },
    { band: "> +10%", min: 10, max: Number.POSITIVE_INFINITY, count: 0 },
  ];

  for (const holding of holdings) {
    const pct = toNumber(holding.unrealized_gain_loss_pct);
    if (pct === undefined) continue;
    const bucket = bands.find((row) => pct > row.min && pct <= row.max);
    if (bucket) bucket.count += 1;
  }

  return bands.map(({ band, count }) => ({ band, count }));
}

function computeRecommendations(
  concentration: ConcentrationDatum[],
  gainLossDistribution: GainLossBandDatum[],
  allocation: AllocationDatum[]
): DashboardRecommendation[] {
  const recommendations: DashboardRecommendation[] = [];
  const biggestPosition = concentration[0];
  if (biggestPosition && biggestPosition.weightPct >= 35) {
    recommendations.push({
      title: `Reduce ${biggestPosition.symbol} concentration`,
      detail: `${biggestPosition.symbol} is ${biggestPosition.weightPct.toFixed(
        1
      )}% of portfolio value.`,
    });
  }

  const losers = gainLossDistribution
    .filter((row) => row.band.includes("-"))
    .reduce((sum, row) => sum + row.count, 0);
  if (losers > 0) {
    recommendations.push({
      title: "Review underperforming positions",
      detail: `${losers} holding${losers === 1 ? "" : "s"} are currently in loss bands.`,
    });
  }

  const cash = allocation.find((row) => row.name.toLowerCase().includes("cash"));
  if (cash && cash.value > 0) {
    recommendations.push({
      title: "Evaluate idle cash allocation",
      detail: "Cash exposure is material; evaluate deployment vs. risk buffer goals.",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      title: "Maintain current strategy",
      detail: "No major concentration or drawdown flags detected from current statement data.",
    });
  }

  return recommendations.slice(0, 3);
}

export function mapPortfolioToDashboardViewModel(portfolioData: PortfolioData): DashboardViewModel {
  const rawHoldings = (
    portfolioData.holdings ||
    portfolioData.detailed_holdings ||
    []
  ) as Holding[];
  const holdings = rawHoldings
    .map(toSafeHolding)
    .filter((row): row is Holding => Boolean(row))
    .sort((a, b) => (toNumber(b.market_value) ?? 0) - (toNumber(a.market_value) ?? 0));
  const holdingsCount = holdings.length;

  const endingValue =
    toNumber(portfolioData.total_value) ??
    toNumber(portfolioData.account_summary?.ending_value) ??
    holdings.reduce((sum, row) => sum + (toNumber(row.market_value) ?? 0), 0);
  const beginningValue =
    toNumber(portfolioData.account_summary?.beginning_value) ??
    (endingValue > 0 ? endingValue : 0);
  const netChange =
    toNumber(portfolioData.account_summary?.change_in_value) ??
    endingValue - beginningValue;
  const changePct = beginningValue > 0 ? (netChange / beginningValue) * 100 : 0;

  const allocation = computeAllocation(portfolioData, holdings, endingValue);
  const history = computeHistory(portfolioData, beginningValue, endingValue);
  const concentration = computeConcentration(holdings, endingValue);
  const gainLossDistribution = computeGainLossDistribution(holdings);
  const recommendations = computeRecommendations(
    concentration,
    gainLossDistribution,
    allocation
  );
  const sectorCoverageCount = holdings.filter((holding) => {
    const value = (holding.sector || holding.asset_type || "").trim().toLowerCase();
    return value.length > 0 && value !== "unknown" && value !== "other";
  }).length;
  const gainLossCoverageCount = holdings.filter(
    (holding) => typeof toNumber(holding.unrealized_gain_loss_pct) === "number"
  ).length;
  const sectorCoveragePct = holdingsCount > 0 ? sectorCoverageCount / holdingsCount : 0;
  const gainLossCoveragePct = holdingsCount > 0 ? gainLossCoverageCount / holdingsCount : 0;
  const quality: DashboardQualityFlags = {
    allocationReady: allocation.length >= 2,
    sectorReady: holdingsCount > 0 && sectorCoveragePct >= 0.35,
    historyReady: history.length >= 2,
    concentrationReady: concentration.length >= 3,
    gainLossReady: gainLossDistribution.some((row) => row.count > 0) && gainLossCoveragePct >= 0.35,
    sectorCoveragePct,
    gainLossCoveragePct,
  };

  return {
    hero: {
      totalValue: endingValue,
      beginningValue,
      endingValue,
      netChange,
      changePct,
      holdingsCount,
      portfolioConcentrationLabel: derivePortfolioConcentrationLabel(holdings),
      statementPeriod: formatStatementPeriod(portfolioData),
    },
    holdings,
    allocation,
    history,
    concentration,
    gainLossDistribution,
    recommendations,
    sourceBrokerage: portfolioData.account_info?.brokerage_name,
    quality,
  };
}
