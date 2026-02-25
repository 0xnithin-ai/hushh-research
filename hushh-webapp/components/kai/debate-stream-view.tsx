"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button as MorphyButton } from "@/lib/morphy-ux/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertCircle, RefreshCw, X, WifiOff, ShieldAlert, Clock, CheckCircle2 } from "lucide-react";
import { Icon } from "@/lib/morphy-ux/ui";
import { setKaiVaultOwnerToken } from "@/lib/services/kai-service";
import { KaiHistoryService, type AnalysisHistoryEntry } from "@/lib/services/kai-history-service";
import { type DecisionResult } from "./views/decision-card";
import { RoundTabsCard } from "./views/round-tabs-card";
import { toast } from "sonner";
import {
  Card as MorphyCard,
  CardContent as MorphyCardContent,
} from "@/lib/morphy-ux/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ApiService } from "@/lib/services/api-service";
import type { KaiHomeInsightsV2 } from "@/lib/services/api-service";
import { CACHE_KEYS, CacheService } from "@/lib/services/cache-service";
import { consumeCanonicalKaiStream } from "@/lib/streaming/kai-stream-client";
import type { KaiStreamEnvelope } from "@/lib/streaming/kai-stream-types";
import { useKaiSession } from "@/lib/stores/kai-session-store";
import { KaiProfileService } from "@/lib/services/kai-profile-service";
import { WorldModelService } from "@/lib/services/world-model-service";
import { cn } from "@/lib/utils";
import {
  getLatestMarketSnapshotFromCache,
  pickPreferredMarketSnapshot,
} from "@/lib/kai/market-snapshot";
import {
  getInitialRoundCollapseState,
  getRoundCollapseStateForDecision,
  getRoundCollapseStateForRound,
} from "./debate-stream-state";

// ============================================================================
// Types
// ============================================================================

export interface AgentState {
  stage: "idle" | "active" | "complete" | "error";
  text: string;
  thoughts: string[];
  error?: string;
  // Rich data from agent_complete
  recommendation?: string;
  confidence?: number;
  metrics?: Record<string, any>;
  sources?: string[];
  // Fundamental-specific
  keyMetrics?: Record<string, any>;
  quantMetrics?: Record<string, any>;
  businessMoat?: string;
  financialResilience?: string;
  growthEfficiency?: string;
  bullCase?: string;
  bearCase?: string;
  // Sentiment-specific
  sentimentScore?: number;
  keyCatalysts?: string[];
  // Valuation-specific
  valuationMetrics?: Record<string, any>;
  peerComparison?: Record<string, any>;
  priceTargets?: Record<string, any>;
}

export interface Insight {
  type: "claim" | "evidence" | "impact" | "bull_case_personalized" | "bear_case_personalized" | "renaissance_verdict";
  id?: string;
  agent: string;
  content: string;
  // Specific fields
  classification?: string; // fact/projection/risk/opportunity
  confidence?: number;
  source?: string;
  magnitude?: string;
  score?: number;
  target_claim_id?: string;
  timestamp: string;
}

const INITIAL_AGENT_STATE: AgentState = {
  stage: "idle",
  text: "",
  thoughts: [],
};

const INITIAL_ROUND_STATE: Record<string, AgentState> = {
  fundamental: { ...INITIAL_AGENT_STATE },
  sentiment: { ...INITIAL_AGENT_STATE },
  valuation: { ...INITIAL_AGENT_STATE },
};

// ============================================================================
// Error Classification
// ============================================================================

type ErrorType = "rate_limit" | "auth_expired" | "server_error" | "connection_lost" | "unknown";

function classifyError(status: number | null, message: string): ErrorType {
  if (status === 429) return "rate_limit";
  if (status === 401 || status === 403) return "auth_expired";
  if (status && status >= 500) return "server_error";
  if (message.includes("fetch") || message.includes("network") || message.includes("abort")) return "connection_lost";
  return "unknown";
}

function sanitizeStatusMessage(message: unknown): string {
  const next = typeof message === "string" ? message.trim() : "";
  if (!next) return "";
  if (/initializ/i.test(next)) return "";
  return next;
}

function getErrorDisplay(errorType: ErrorType, retryIn?: number): { icon: React.ReactNode; title: string; message: string } {
  switch (errorType) {
    case "rate_limit":
      return {
        icon: <Icon icon={Clock} size={32} className="text-amber-500" />,
        title: "Rate Limit Reached",
        message: retryIn ? `Too many requests. Retrying in ${retryIn}s...` : "Too many requests. Please try again in a moment.",
      };
    case "auth_expired":
      return {
        icon: <Icon icon={ShieldAlert} size={32} className="text-red-500" />,
        title: "Session Expired",
        message: "Your session has expired. Please re-authenticate to continue.",
      };
    case "server_error":
      return {
        icon: <Icon icon={AlertCircle} size={32} className="text-red-500" />,
        title: "Server Error",
        message: retryIn ? `Server encountered an error. Retrying in ${retryIn}s...` : "Server error. Please try again.",
      };
    case "connection_lost":
      return {
        icon: <Icon icon={WifiOff} size={32} className="text-orange-500" />,
        title: "Connection Lost",
        message: "Lost connection to the analysis server.",
      };
    default:
      return {
        icon: <Icon icon={AlertCircle} size={32} className="text-red-500" />,
        title: "Analysis Interrupted",
        message: "An unexpected error occurred.",
      };
  }
}

// ============================================================================
// Constants
// ============================================================================

const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000]; // Exponential backoff
const HEADER_MARKET_QUOTE_TTL_MS = 10 * 60 * 1000;

const TICKER_SYMBOL_REGEX = /^[A-Z][A-Z0-9.\-]{0,5}$/;

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,%\s,]/g, "").trim();
    if (!cleaned) return undefined;
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function isCashEquivalentRow(row: {
  symbol: string;
  name: string;
  asset_type?: string;
}): boolean {
  const hint = `${row.symbol} ${row.name} ${row.asset_type || ""}`.toLowerCase();
  return (
    hint.includes("cash") ||
    hint.includes("sweep") ||
    hint.includes("money market") ||
    hint.includes("retail prime") ||
    hint.includes("first american") ||
    hint.includes("fxrxx")
  );
}

function pickFirstNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = toFiniteNumber(source[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function extractDebatePortfolioContext(
  userId: string,
  source?: Record<string, unknown> | null
): Record<string, unknown> | null {
  const cache = CacheService.getInstance();
  const cached =
    source ??
    cache.get<Record<string, unknown>>(CACHE_KEYS.PORTFOLIO_DATA(userId)) ??
    cache.get<Record<string, unknown>>(CACHE_KEYS.DOMAIN_DATA(userId, "financial"));
  if (!cached || typeof cached !== "object" || Array.isArray(cached)) return null;

  const holdingsRaw = Array.isArray(cached.holdings)
    ? cached.holdings
    : cached.portfolio &&
        typeof cached.portfolio === "object" &&
        !Array.isArray(cached.portfolio) &&
        Array.isArray((cached.portfolio as Record<string, unknown>).holdings)
      ? ((cached.portfolio as Record<string, unknown>).holdings as unknown[])
      : [];

  const holdings = holdingsRaw
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    .slice(0, 30)
    .map((row) => ({
      symbol: String(row.symbol ?? "").trim().toUpperCase(),
      name: String(row.name ?? "").trim(),
      quantity: toFiniteNumber(row.quantity),
      market_value: toFiniteNumber(row.market_value),
      unrealized_gain_loss_pct: toFiniteNumber(row.unrealized_gain_loss_pct),
      sector: typeof row.sector === "string" ? row.sector : undefined,
      asset_type:
        typeof row.asset_type === "string"
          ? row.asset_type
          : typeof row.asset_class === "string"
            ? row.asset_class
            : undefined,
      is_investable: typeof row.is_investable === "boolean" ? row.is_investable : undefined,
      is_cash_equivalent:
        typeof row.is_cash_equivalent === "boolean" ? row.is_cash_equivalent : undefined,
      is_sec_common_equity_ticker:
        typeof row.is_sec_common_equity_ticker === "boolean"
          ? row.is_sec_common_equity_ticker
          : undefined,
      symbol_kind: typeof row.symbol_kind === "string" ? row.symbol_kind : undefined,
      security_listing_status:
        typeof row.security_listing_status === "string"
          ? row.security_listing_status
          : undefined,
      analyze_eligible_reason:
        typeof row.analyze_eligible_reason === "string"
          ? row.analyze_eligible_reason
          : undefined,
    }))
    .filter((row) => row.symbol.length > 0 || row.name.length > 0);

  const nonCashHoldings = holdings.filter((row) => !isCashEquivalentRow(row));
  const investableHoldings = nonCashHoldings.filter((row) => TICKER_SYMBOL_REGEX.test(row.symbol));
  const excludedPositions = nonCashHoldings
    .filter((row) => !TICKER_SYMBOL_REGEX.test(row.symbol))
    .slice(0, 20)
    .map((row) => ({
      symbol: row.symbol || row.name || "UNKNOWN",
      reason: "missing_ticker_alias",
    }));
  const cashPositionsCount = holdings.length - nonCashHoldings.length;
  const tickerCoveragePct =
    nonCashHoldings.length > 0 ? investableHoldings.length / nonCashHoldings.length : 0;
  const sectorCoveragePct =
    nonCashHoldings.length > 0
      ? nonCashHoldings.filter((row) => Boolean(row.sector && row.sector.trim())).length / nonCashHoldings.length
      : 0;
  const gainLossCoveragePct =
    nonCashHoldings.length > 0
      ? nonCashHoldings.filter((row) => typeof row.unrealized_gain_loss_pct === "number").length /
        nonCashHoldings.length
      : 0;
  const topPositions = holdings
    .slice()
    .sort((a, b) => (b.market_value || 0) - (a.market_value || 0))
    .slice(0, 8)
    .map((row) => ({
      symbol: row.symbol || row.name || "UNKNOWN",
      market_value: row.market_value ?? null,
      sector: row.sector ?? null,
      asset_type: row.asset_type ?? null,
    }));
  const accountSummary =
    cached.account_summary && typeof cached.account_summary === "object" && !Array.isArray(cached.account_summary)
      ? (cached.account_summary as Record<string, unknown>)
      : {};
  const statementSignals = {
    investment_gain_loss: pickFirstNumber(accountSummary, [
      "investment_gain_loss",
      "total_change",
      "change_in_value",
    ]),
    total_income_period: pickFirstNumber(accountSummary, ["total_income_period"]),
    total_income_ytd: pickFirstNumber(accountSummary, ["total_income_ytd"]),
    total_fees: pickFirstNumber(accountSummary, ["total_fees"]),
    net_deposits_period: pickFirstNumber(accountSummary, [
      "net_deposits_period",
      "net_deposits_withdrawals",
    ]),
    net_deposits_ytd: pickFirstNumber(accountSummary, ["net_deposits_ytd"]),
  };

  return {
    holdings,
    holdings_count: holdings.length,
    account_summary: Object.keys(accountSummary).length > 0 ? accountSummary : undefined,
    asset_allocation:
      cached.asset_allocation && typeof cached.asset_allocation === "object"
        ? cached.asset_allocation
        : undefined,
    income_summary:
      cached.income_summary && typeof cached.income_summary === "object"
        ? cached.income_summary
        : undefined,
    realized_gain_loss:
      cached.realized_gain_loss && typeof cached.realized_gain_loss === "object"
        ? cached.realized_gain_loss
        : undefined,
    quality_report_v2:
      cached.quality_report_v2 && typeof cached.quality_report_v2 === "object"
        ? cached.quality_report_v2
        : undefined,
    total_value: toFiniteNumber(cached.total_value),
    cash_balance: toFiniteNumber(cached.cash_balance),
    debate_context: {
      portfolio_snapshot: {
        holdings_count: holdings.length,
        non_cash_holdings_count: nonCashHoldings.length,
        investable_holdings_count: investableHoldings.length,
        cash_positions_count: cashPositionsCount,
        total_value: toFiniteNumber(cached.total_value),
        cash_balance: toFiniteNumber(cached.cash_balance),
      },
      coverage: {
        ticker_coverage_pct: tickerCoveragePct,
        sector_coverage_pct: sectorCoveragePct,
        gain_loss_coverage_pct: gainLossCoveragePct,
      },
      statement_signals: statementSignals,
      eligible_symbols: investableHoldings
        .map((row) => row.symbol)
        .filter((symbol, index, arr) => symbol.length > 0 && arr.indexOf(symbol) === index)
        .slice(0, 20),
      top_positions: topPositions,
      excluded_positions: excludedPositions,
    },
  };
}

function hasRequiredDebateContext(context: Record<string, unknown> | null): boolean {
  if (!context) return false;
  const holdings = context.holdings;
  const debateContext = context.debate_context;
  if (!Array.isArray(holdings) || holdings.length === 0) return false;
  if (!debateContext || typeof debateContext !== "object" || Array.isArray(debateContext)) return false;
  const debate = debateContext as Record<string, unknown>;
  const snapshot = debate.portfolio_snapshot;
  const coverage = debate.coverage;
  const hasSnapshot =
    Boolean(snapshot) && typeof snapshot === "object" && !Array.isArray(snapshot);
  const hasCoverage =
    Boolean(coverage) && typeof coverage === "object" && !Array.isArray(coverage);
  return hasSnapshot && hasCoverage;
}

// ============================================================================
// Component
// ============================================================================

interface DebateStreamViewProps {
  ticker: string;
  userId: string;
  riskProfile?: string;
  vaultOwnerToken: string;
  vaultKey?: string;
  onClose: () => void;
  onDecisionSaved?: (entry: AnalysisHistoryEntry) => void;
  showHeader?: boolean;
}

type MarketSnapshot = {
  last_price: number | null;
  change_pct: number | null;
  observed_at: string | null;
  source: string;
};

type HeaderMarketQuote = {
  last_price: number | null;
  change_pct: number | null;
  observed_at: string | null;
  source: string;
};

function toMarketNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,\s]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function extractMarketSnapshotFromDecision(data: Record<string, any>): MarketSnapshot {
  const rawCard =
    data.raw_card && typeof data.raw_card === "object" ? (data.raw_card as Record<string, unknown>) : {};
  const keyMetrics =
    rawCard.key_metrics && typeof rawCard.key_metrics === "object"
      ? (rawCard.key_metrics as Record<string, unknown>)
      : {};
  const valuationMetrics =
    keyMetrics.valuation && typeof keyMetrics.valuation === "object"
      ? (keyMetrics.valuation as Record<string, unknown>)
      : {};
  const priceTargets =
    rawCard.price_targets && typeof rawCard.price_targets === "object"
      ? (rawCard.price_targets as Record<string, unknown>)
      : {};

  const candidates: Array<{ value: unknown; source: string }> = [
    { value: rawCard.current_price, source: "raw_card.current_price" },
    { value: valuationMetrics.current_price, source: "raw_card.key_metrics.valuation.current_price" },
    { value: valuationMetrics.price, source: "raw_card.key_metrics.valuation.price" },
    { value: priceTargets.current_price, source: "raw_card.price_targets.current_price" },
    { value: priceTargets.current, source: "raw_card.price_targets.current" },
    { value: priceTargets.market_price, source: "raw_card.price_targets.market_price" },
  ];
  for (const candidate of candidates) {
    const parsed = toMarketNumber(candidate.value);
    if (parsed !== null) {
      return {
        last_price: parsed,
        change_pct: toMarketNumber(rawCard.day_change_pct ?? rawCard.change_pct ?? data.day_change_pct),
        observed_at:
          (typeof rawCard.analysis_updated_at === "string" && rawCard.analysis_updated_at) ||
          (typeof data.analysis_updated_at === "string" && data.analysis_updated_at) ||
          new Date().toISOString(),
        source: candidate.source,
      };
    }
  }

  return {
    last_price: null,
    change_pct: null,
    observed_at:
      (typeof rawCard.analysis_updated_at === "string" && rawCard.analysis_updated_at) ||
      (typeof data.analysis_updated_at === "string" && data.analysis_updated_at) ||
      null,
    source: "unavailable",
  };
}

function toEpoch(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickPreferredHeaderQuote(
  current: HeaderMarketQuote | null,
  candidate: HeaderMarketQuote | null
): HeaderMarketQuote | null {
  if (!candidate || candidate.last_price === null || candidate.last_price <= 0) {
    return current;
  }
  if (!current || current.last_price === null || current.last_price <= 0) {
    return candidate;
  }
  const currentEpoch = toEpoch(current.observed_at);
  const candidateEpoch = toEpoch(candidate.observed_at);
  if (candidateEpoch > currentEpoch) return candidate;
  if (candidateEpoch === currentEpoch) {
    if (current.change_pct === null && candidate.change_pct !== null) return candidate;
    if (candidate.last_price !== current.last_price) return candidate;
  }
  return current;
}

function collectHeaderQuoteCandidate(params: {
  ticker: string;
  source: string;
  symbol: unknown;
  price: unknown;
  changePct: unknown;
  observedAt?: unknown;
  payloadGeneratedAt?: string | null;
}): HeaderMarketQuote | null {
  const symbol = String(params.symbol || "")
    .trim()
    .toUpperCase();
  if (!symbol || symbol !== params.ticker) return null;

  const price = toMarketNumber(params.price);
  if (price === null || price <= 0) return null;
  const changePct = toMarketNumber(params.changePct);
  const observedAtRaw = String(params.observedAt || "").trim();

  return {
    last_price: price,
    change_pct: changePct,
    observed_at: observedAtRaw || params.payloadGeneratedAt || null,
    source: params.source,
  };
}

function extractHeaderQuoteFromKaiHome(
  payload: KaiHomeInsightsV2 | null | undefined,
  ticker: string
): HeaderMarketQuote | null {
  if (!payload || typeof payload !== "object") return null;
  const normalizedTicker = String(ticker || "")
    .trim()
    .toUpperCase();
  if (!normalizedTicker) return null;

  const generatedAt = typeof payload.generated_at === "string" ? payload.generated_at : null;
  let best: HeaderMarketQuote | null = null;

  const watchlist = Array.isArray(payload.watchlist) ? payload.watchlist : [];
  for (const row of watchlist) {
    const candidate = collectHeaderQuoteCandidate({
      ticker: normalizedTicker,
      source: "market_home.watchlist",
      symbol: row?.symbol,
      price: row?.price,
      changePct: row?.change_pct,
      observedAt: row?.as_of,
      payloadGeneratedAt: generatedAt,
    });
    best = pickPreferredHeaderQuote(best, candidate);
  }

  const spotlights = Array.isArray(payload.spotlights) ? payload.spotlights : [];
  for (const row of spotlights) {
    const candidate = collectHeaderQuoteCandidate({
      ticker: normalizedTicker,
      source: "market_home.spotlights",
      symbol: row?.symbol,
      price: row?.price,
      changePct: row?.change_pct,
      observedAt: row?.as_of,
      payloadGeneratedAt: generatedAt,
    });
    best = pickPreferredHeaderQuote(best, candidate);
  }

  const movers = [
    ...(Array.isArray(payload.movers?.active) ? payload.movers.active : []),
    ...(Array.isArray(payload.movers?.gainers) ? payload.movers.gainers : []),
    ...(Array.isArray(payload.movers?.losers) ? payload.movers.losers : []),
  ];
  for (const row of movers) {
    const candidate = collectHeaderQuoteCandidate({
      ticker: normalizedTicker,
      source: "market_home.movers",
      symbol: row?.symbol,
      price: row?.price,
      changePct: row?.change_pct,
      observedAt: row?.as_of,
      payloadGeneratedAt: generatedAt,
    });
    best = pickPreferredHeaderQuote(best, candidate);
  }

  return best;
}

function getCachedHeaderQuote(userId: string, ticker: string): HeaderMarketQuote | null {
  const cache = CacheService.getInstance();
  const prefix = `kai_market_home_${userId}_`;
  let best: HeaderMarketQuote | null = null;
  for (const key of cache.getStats().keys) {
    if (!key.startsWith(prefix)) continue;
    const payload = cache.get<KaiHomeInsightsV2>(key);
    if (!payload) continue;
    const candidate = extractHeaderQuoteFromKaiHome(payload, ticker);
    best = pickPreferredHeaderQuote(best, candidate);
  }
  return best;
}

function formatHeaderPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Price unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function DebateStreamView({
  ticker,
  userId,
  riskProfile: riskProfileProp,
  vaultOwnerToken,
  vaultKey,
  onClose,
  onDecisionSaved,
  showHeader = true,
}: DebateStreamViewProps) {
  const setBusyOperation = useKaiSession((s) => s.setBusyOperation);
  const normalizedTicker = useMemo(
    () => String(ticker || "").trim().toUpperCase(),
    [ticker]
  );
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<ErrorType>("unknown");
  const [kaiThinking, setKaiThinking] = useState<string>("");
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);

  // Rounds
  const [activeRound, setActiveRound] = useState<1 | 2>(1);
  const activeRoundRef = useRef<1 | 2>(1);
  const [round1States, setRound1States] = useState<Record<string, AgentState>>(
    JSON.parse(JSON.stringify(INITIAL_ROUND_STATE))
  );
  const [round2States, setRound2States] = useState<Record<string, AgentState>>(
    JSON.parse(JSON.stringify(INITIAL_ROUND_STATE))
  );

  // Live Insights State
  const [_insights, setInsights] = useState<Insight[]>([]);
  const insightsRef = useRef<Insight[]>([]); // Ref for stream safety

  // Refs for robust state tracking inside async stream
  const round1StatesRef = useRef<Record<string, AgentState>>(JSON.parse(JSON.stringify(INITIAL_ROUND_STATE)));
  const round2StatesRef = useRef<Record<string, AgentState>>(JSON.parse(JSON.stringify(INITIAL_ROUND_STATE)));

  // UI Control
  const [activeAgent, setActiveAgent] = useState("fundamental");
  const [collapsedRounds, setCollapsedRounds] = useState<Record<number, boolean>>(
    getInitialRoundCollapseState()
  );

  const [decision, setDecision] = useState<DecisionResult | null>(null);
  const [headerMarketQuote, setHeaderMarketQuote] = useState<HeaderMarketQuote | null>(null);
  const headerPrice = headerMarketQuote?.last_price ?? null;
  const headerChangePct = headerMarketQuote?.change_pct ?? null;

  // ---- Overall progress computation ----
  const AGENTS = ["fundamental", "sentiment", "valuation"] as const;

  const overallProgress = useMemo(() => {
    let progress = 0;
    // Round 1: each agent complete = +14%, active/streaming = +7%
    for (const agent of AGENTS) {
      const s = round1States[agent]?.stage;
      if (s === "complete") progress += 14;
      else if (s === "active") progress += 7;
    }
    // Round 2: same weighting
    for (const agent of AGENTS) {
      const s = round2States[agent]?.stage;
      if (s === "complete") progress += 14;
      else if (s === "active") progress += 7;
    }
    // Decision phase bump
    if (decision) progress = 100;
    else if (activeRound > 1 && round2States.valuation?.stage === "complete") {
      progress = Math.max(progress, 90); // awaiting decision
    }
    return Math.min(progress, 100);
  }, [round1States, round2States, decision, activeRound]);

  const progressLabel = useMemo(() => {
    if (decision) return "Analysis complete";
    const agentLabels: Record<string, string> = {
      fundamental: "Fundamental",
      sentiment: "Sentiment",
      valuation: "Valuation",
    };
    // Find the currently active agent
    const states = activeRound === 1 ? round1States : round2States;
    for (const agent of AGENTS) {
      if (states[agent]?.stage === "active") {
        return `Round ${activeRound} — ${agentLabels[agent]} Agent`;
      }
    }
    // If no agent is active, check if all are complete
    const allComplete = AGENTS.every((a) => states[a]?.stage === "complete");
    if (allComplete && activeRound === 1) return "Round 1 complete — transitioning…";
    if (allComplete && activeRound === 2) return "Forming consensus…";
    return `Round ${activeRound} — Analyzing…`;
  }, [round1States, round2States, activeRound, decision]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const hasStartedRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Helper to update specific agent state in current round
  const updateAgentState = useCallback((round: 1 | 2, agent: string, update: Partial<AgentState>) => {
    // Update Ref (Source of Truth for Stream)
    const ref = round === 1 ? round1StatesRef : round2StatesRef;
    if (ref.current[agent]) {
       ref.current[agent] = { ...ref.current[agent], ...update };
    }

    // Update React State
    const setter = round === 1 ? setRound1States : setRound2States;
    setter((prev) => {
      const currentState = prev[agent];
      if (!currentState) return prev;
      return {
        ...prev,
        [agent]: { ...currentState, ...update },
      };
    });
  }, []);

  // Handle close - ensuring ABORT
  const handleClose = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
    }
    setBusyOperation("stock_analysis_stream", false);
    onClose();
  }, [onClose, setBusyOperation]);

  useEffect(() => {
    if (!showHeader) {
      setHeaderMarketQuote(null);
      return;
    }
    if (!userId || !normalizedTicker) {
      setHeaderMarketQuote(null);
      return;
    }
    let cancelled = false;
    const cache = CacheService.getInstance();
    const cached = getCachedHeaderQuote(userId, normalizedTicker);
    if (!cancelled) {
      setHeaderMarketQuote(cached);
    }

    if (!vaultOwnerToken) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const payload = await ApiService.getKaiMarketInsights({
          userId,
          vaultOwnerToken,
          symbols: [normalizedTicker],
          daysBack: 7,
        });
        const liveQuote = extractHeaderQuoteFromKaiHome(payload, normalizedTicker);
        if (!cancelled) {
          setHeaderMarketQuote((prev) => pickPreferredHeaderQuote(prev, liveQuote));
        }
        cache.set(
          CACHE_KEYS.KAI_MARKET_HOME(userId, normalizedTicker, 7),
          payload,
          HEADER_MARKET_QUOTE_TTL_MS
        );
      } catch {
        // Non-blocking: keep best known cached quote in header.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [normalizedTicker, showHeader, userId, vaultOwnerToken]);

  // Reset state for retry
  const resetState = useCallback(() => {
    setLoading(true);
    setError(null);
    setErrorType("unknown");
    setKaiThinking("");
    activeRoundRef.current = 1;
    setActiveRound(1);
    setRound1States(JSON.parse(JSON.stringify(INITIAL_ROUND_STATE)));
    setRound2States(JSON.parse(JSON.stringify(INITIAL_ROUND_STATE)));
    setActiveAgent("fundamental");
    setCollapsedRounds(getInitialRoundCollapseState());
    setDecision(null);
    setInsights([]);
    setRetryCountdown(null);
    // Reset refs
    round1StatesRef.current = JSON.parse(JSON.stringify(INITIAL_ROUND_STATE));
    round2StatesRef.current = JSON.parse(JSON.stringify(INITIAL_ROUND_STATE));
  }, []);

  // Start stream with retry logic
  const startStream = useCallback(
    async (isRetry = false) => {
      if (!isRetry && hasStartedRef.current) return;
      hasStartedRef.current = true;

      // Ensure token is set for service layer
      if (vaultOwnerToken) {
        setKaiVaultOwnerToken(vaultOwnerToken);
      }

      try {
        if (!isRetry) {
          setLoading(true);
          setError(null);
        }
        setBusyOperation("stock_analysis_stream", true);
        abortControllerRef.current = new AbortController();

        // Build user context payload for backend personalization.
        let context: Record<string, unknown> | null = null;
        let effectiveRiskProfile = riskProfileProp || "balanced";
        if (vaultKey) {
          try {
            const profile = await KaiProfileService.getProfile({
              userId,
              vaultKey,
              vaultOwnerToken,
            });
            effectiveRiskProfile =
              (profile.preferences.risk_profile as unknown as string | null) ||
              effectiveRiskProfile;
            context = {
              user_name: userId,
              preferences: {
                investment_horizon: profile.preferences.investment_horizon,
                investment_horizon_selected_at:
                  profile.preferences.investment_horizon_selected_at,
                investment_horizon_anchor_at:
                  profile.preferences.investment_horizon_anchor_at,
                drawdown_response: profile.preferences.drawdown_response,
                drawdown_response_selected_at:
                  profile.preferences.drawdown_response_selected_at,
                volatility_preference: profile.preferences.volatility_preference,
                volatility_preference_selected_at:
                  profile.preferences.volatility_preference_selected_at,
                risk_score: profile.preferences.risk_score,
                risk_profile: profile.preferences.risk_profile,
                risk_profile_selected_at:
                  profile.preferences.risk_profile_selected_at,
              },
              financial_profile: profile,
            };
          } catch (err) {
            console.warn("[DebateStreamView] Failed to load Kai profile context:", err);
            // Non-fatal, proceed without context
          }
        }

        let portfolioContext = extractDebatePortfolioContext(userId);
        if (!hasRequiredDebateContext(portfolioContext) && vaultKey) {
          try {
            const fullBlob = await WorldModelService.loadFullBlob({
              userId,
              vaultKey,
              vaultOwnerToken,
            });
            const financialDomain =
              fullBlob.financial && typeof fullBlob.financial === "object" && !Array.isArray(fullBlob.financial)
                ? (fullBlob.financial as Record<string, unknown>)
                : null;
            const hydratedContext =
              extractDebatePortfolioContext(userId, financialDomain ?? fullBlob) ?? portfolioContext;
            portfolioContext = hydratedContext;
          } catch (err) {
            console.warn("[DebateStreamView] Failed to hydrate debate context from world-model blob:", err);
          }
        }
        if (portfolioContext) {
          context = {
            ...(context || {}),
            ...portfolioContext,
          };
        }

        // Start SSE connection via ApiService.
        // This centralizes Android localhost→10.0.2.2 normalization and
        // uses native plugins on iOS/Android when available.
        const response = await ApiService.streamKaiAnalysis({
          userId,
          ticker,
          riskProfile: effectiveRiskProfile,
          userContext: context, // Pass the FULL decrypted context object
          vaultOwnerToken,
          signal: abortControllerRef.current.signal,
        });

        // If the user closes/back while the native plugin is still streaming,
        // we still abort UI processing; plugin continues but listener cleanup
        // is handled within ApiService.
        if (abortControllerRef.current.signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        if (!response.ok) {
          const status = response.status;
          const errType = classifyError(status, "");

          // Auto-retry for retryable errors
          if ((errType === "rate_limit" || errType === "server_error") && retryCountRef.current < MAX_RETRIES) {
            const delay = RETRY_DELAYS[retryCountRef.current] || 8000;
            retryCountRef.current++;
            const seconds = Math.ceil(delay / 1000);
            setRetryCountdown(seconds);
            setErrorType(errType);
            setKaiThinking(`${errType === "rate_limit" ? "Rate limited" : "Server error"}. Retrying in ${seconds}s...`);

            // Countdown timer
            let countdown = seconds;
            const countdownInterval = setInterval(() => {
              countdown--;
              setRetryCountdown(countdown);
              if (countdown <= 0) {
                clearInterval(countdownInterval);
              }
            }, 1000);

            retryTimerRef.current = setTimeout(() => {
              clearInterval(countdownInterval);
              setRetryCountdown(null);
              startStream(true);
            }, delay);
            return;
          }

          throw new Error(`API error: ${status}`);
        }

        // Reset retry count on successful connection
        retryCountRef.current = 0;
        setLoading(false);
        setRetryCountdown(null);

        const resolveRound = (data: Record<string, any>): 1 | 2 => {
          if (data.round === 2 || data.round === "2") return 2;
          if (data.round === 1 || data.round === "1") return 1;
          const phase = typeof data.phase === "string" ? data.phase.toLowerCase() : "";
          if (phase === "debate" || phase === "round2" || phase === "decision") return 2;
          if (phase === "analysis" || phase === "round1") return 1;
          return activeRoundRef.current;
        };

        await consumeCanonicalKaiStream(
          response,
          (envelope: KaiStreamEnvelope) => {
            const resolvedEventType = envelope.event;
            const data = envelope.payload as Record<string, any>;

            switch (resolvedEventType) {
              case "start": {
                const message =
                  (typeof data.message === "string" && data.message) ||
                  (typeof data.text === "string" ? data.text : "");
                const statusMessage = sanitizeStatusMessage(message);
                if (statusMessage) {
                  setKaiThinking(statusMessage);
                }
                break;
              }
              case "warning": {
                const message =
                  (typeof data.message === "string" && data.message) ||
                  (typeof data.code === "string" ? data.code : "Streaming warning");
                const statusMessage = sanitizeStatusMessage(message);
                if (statusMessage) {
                  setKaiThinking(statusMessage);
                  toast.warning("Streaming warning", { description: message });
                }
                break;
              }
              case "kai_thinking": {
                setKaiThinking(sanitizeStatusMessage(
                  (typeof data.message === "string" && data.message) ||
                    (typeof data.text === "string" ? data.text : "")
                ));
                const r = resolveRound(data);
                if (r === 2 && activeRoundRef.current !== 2) {
                  activeRoundRef.current = 2;
                  setActiveRound(2);
                  setCollapsedRounds(getRoundCollapseStateForRound(2));
                  toast.info("Entering Round 2: Debate & Rebuttal");
                }
                break;
              }
              case "debate_round":
              case "round_start": {
                const r = resolveRound(data);
                if (r === 2 && activeRoundRef.current !== 2) {
                  activeRoundRef.current = 2;
                  setActiveRound(2);
                  setCollapsedRounds(getRoundCollapseStateForRound(2));
                }
                break;
              }
              case "agent_start": {
                const r = resolveRound(data);
                if (r === 2 && activeRoundRef.current !== 2) {
                  activeRoundRef.current = 2;
                  setActiveRound(2);
                }
                setActiveAgent((data.agent || "").toString());
                updateAgentState(r, (data.agent || "").toString(), { stage: "active" });
                break;
              }
              case "agent_token": {
                const ag = (data.agent || data.agent_name || "").toString().toLowerCase();
                const txt = (data.text || data.token || "").toString();
                if (!ag || !txt) break;
                const r = resolveRound(data);
                if (r === 2 && activeRoundRef.current !== 2) {
                  activeRoundRef.current = 2;
                  setActiveRound(2);
                }

                const ref = r === 1 ? round1StatesRef : round2StatesRef;
                const runRef = ref.current;
                if (runRef?.[ag]) {
                  runRef[ag] = {
                    ...runRef[ag],
                    stage: runRef[ag].stage === "idle" ? "active" : runRef[ag].stage,
                    text: (runRef[ag].text || "") + txt,
                  };
                }

                const setter = r === 1 ? setRound1States : setRound2States;
                setter((prev) => ({
                  ...prev,
                  [ag]: {
                    ...prev[ag],
                    stage: prev[ag]?.stage === "idle" ? "active" : prev[ag]?.stage,
                    text: (prev[ag]?.text || "") + txt,
                  },
                }));
                break;
              }
              case "agent_complete": {
                const r = resolveRound(data);
                updateAgentState(r, (data.agent || "").toString(), {
                  stage: "complete",
                  text: data.summary || "",
                  thoughts: [],
                  recommendation: data.recommendation,
                  confidence: data.confidence,
                  sources: data.sources,
                  keyMetrics: data.key_metrics,
                  quantMetrics: data.quant_metrics,
                  businessMoat: data.business_moat,
                  financialResilience: data.financial_resilience,
                  growthEfficiency: data.growth_efficiency,
                  bullCase: data.bull_case,
                  bearCase: data.bear_case,
                  sentimentScore: data.sentiment_score,
                  keyCatalysts: data.key_catalysts,
                  valuationMetrics: data.valuation_metrics,
                  peerComparison: data.peer_comparison,
                  priceTargets: data.price_targets,
                });
                break;
              }
              case "agent_error": {
                const r = resolveRound(data);
                const errMsg = data.error || "Agent analysis failed";
                updateAgentState(r, (data.agent || "").toString(), {
                  stage: "error",
                  error: errMsg,
                });
                toast.error(`${data.agent} encountered an error`, {
                  description: errMsg.length > 100 ? errMsg.slice(0, 100) + "..." : errMsg,
                });
                break;
              }
              case "insight_extracted": {
                const insightType = (data.type || "claim") as Insight["type"];
                const newInsight: Insight = {
                  type: insightType,
                  agent: (data.agent || "kai").toString(),
                  content: (data.content || "").toString(),
                  id: data.id ? data.id.toString() : undefined,
                  classification: data.classification ? data.classification.toString() : undefined,
                  confidence: typeof data.confidence === "number" ? data.confidence : undefined,
                  source: data.source ? data.source.toString() : undefined,
                  magnitude: data.magnitude ? data.magnitude.toString() : undefined,
                  score: typeof data.score === "number" ? data.score : undefined,
                  target_claim_id: data.target_claim_id ? data.target_claim_id.toString() : undefined,
                  timestamp: new Date().toISOString(),
                };

                setInsights((prev) => [...prev, newInsight]);
                insightsRef.current.push(newInsight);
                if (data.type === "impact" && (data.magnitude === "high" || data.score >= 8)) {
                  toast(data.classification === "risk" ? "⚠️ Portfolio Risk Detected" : "🚀 Portfolio Opportunity", {
                    description: data.content,
                    action: { label: "View", onClick: () => {} },
                  });
                }
                break;
              }
              case "decision": {
                const degradedAgents = Array.isArray(data.degraded_agents)
                  ? data.degraded_agents
                      .map((item) => String(item || "").trim().toLowerCase())
                      .filter((item) => item.length > 0)
                  : [];
                const backendShort =
                  typeof data.short_recommendation === "string"
                    ? data.short_recommendation.trim()
                    : "";
                const rawCardShort =
                  typeof (data.raw_card as Record<string, unknown> | undefined)?.short_recommendation ===
                  "string"
                    ? String((data.raw_card as Record<string, unknown>).short_recommendation).trim()
                    : "";
                const fallbackShort =
                  typeof data.final_statement === "string" && data.final_statement.trim().length > 0
                    ? data.final_statement.trim().slice(0, 280)
                    : "Final recommendation synthesized from the completed debate.";

                const marketSnapshot = extractMarketSnapshotFromDecision(data);
                const cachedMarketSnapshot = getLatestMarketSnapshotFromCache(
                  userId,
                  String(data.ticker || ticker).toUpperCase()
                );
                const resolvedMarketSnapshot =
                  pickPreferredMarketSnapshot(marketSnapshot, cachedMarketSnapshot) || marketSnapshot;
                const incomingRawCard =
                  data.raw_card && typeof data.raw_card === "object"
                    ? (data.raw_card as DecisionResult["raw_card"])
                    : {};
                const normalizedDecision: DecisionResult = {
                  ticker: String(data.ticker || ticker).toUpperCase(),
                  decision: String(data.decision || "hold"),
                  confidence: Number(data.confidence || 0),
                  consensus_reached: Boolean(data.consensus_reached),
                  final_statement: String(data.final_statement || ""),
                  short_recommendation: backendShort || rawCardShort || fallbackShort,
                  analysis_degraded:
                    Boolean(data.analysis_degraded) ||
                    Boolean((data.raw_card as Record<string, unknown> | undefined)?.analysis_degraded),
                  degraded_agents: degradedAgents,
                  stream_id:
                    typeof data.stream_id === "string"
                      ? data.stream_id
                      : typeof (data.raw_card as Record<string, unknown> | undefined)?.stream_diagnostics === "object"
                        ? String(
                            ((data.raw_card as Record<string, unknown>).stream_diagnostics as Record<string, unknown>)
                              .stream_id || ""
                          )
                        : undefined,
                  llm_calls_count:
                    typeof data.llm_calls_count === "number"
                      ? data.llm_calls_count
                      : undefined,
                  provider_calls_count:
                    typeof data.provider_calls_count === "number"
                      ? data.provider_calls_count
                      : undefined,
                  retry_counts:
                    data.retry_counts && typeof data.retry_counts === "object"
                      ? (data.retry_counts as Record<string, number>)
                      : undefined,
                  analysis_mode:
                    typeof data.analysis_mode === "string" ? data.analysis_mode : undefined,
                  agent_votes:
                    data.agent_votes && typeof data.agent_votes === "object"
                      ? (data.agent_votes as Record<string, string>)
                      : undefined,
                  dissenting_opinions: Array.isArray(data.dissenting_opinions)
                    ? data.dissenting_opinions.map((value: unknown) => String(value))
                    : undefined,
                  fundamental_summary:
                    typeof data.fundamental_summary === "string"
                      ? data.fundamental_summary
                      : undefined,
                  sentiment_summary:
                    typeof data.sentiment_summary === "string"
                      ? data.sentiment_summary
                      : undefined,
                  valuation_summary:
                    typeof data.valuation_summary === "string"
                      ? data.valuation_summary
                      : undefined,
                  raw_card: {
                    ...incomingRawCard,
                    market_snapshot: resolvedMarketSnapshot,
                  } as DecisionResult["raw_card"],
                };
                setDecision(normalizedDecision);
                setKaiThinking("Analysis Complete.");
                setCollapsedRounds(getRoundCollapseStateForDecision());
                setBusyOperation("stock_analysis_stream", false);
                const historyEntry: AnalysisHistoryEntry = {
                  ticker: ticker.toUpperCase(),
                  timestamp: new Date().toISOString(),
                  decision: normalizedDecision.decision || "hold",
                  confidence: normalizedDecision.confidence || 0,
                  consensus_reached: normalizedDecision.consensus_reached ?? false,
                  agent_votes: normalizedDecision.agent_votes || {},
                  final_statement: normalizedDecision.final_statement || "",
                  raw_card: normalizedDecision.raw_card || {},
                  debate_transcript: {
                    round1: round1StatesRef.current,
                    round2: round2StatesRef.current,
                  },
                };
                onDecisionSaved?.(historyEntry);
                if (vaultKey && userId) {
                  KaiHistoryService.saveAnalysis({
                    userId,
                    vaultKey,
                    vaultOwnerToken,
                    entry: historyEntry,
                  })
                    .then(() => undefined)
                    .catch((e) => console.warn("[DebateStreamView] History save failed:", e));
                }
                break;
              }
              case "error": {
                const errMsg = data.message || "Analysis failed";
                const errType = classifyError(null, errMsg);
                setBusyOperation("stock_analysis_stream", false);
                const hasProgress =
                  AGENTS.some((agent) => round1StatesRef.current[agent]?.stage !== "idle") ||
                  AGENTS.some((agent) => round2StatesRef.current[agent]?.stage !== "idle");
                if (
                  !hasProgress &&
                  (errType === "rate_limit" || errType === "server_error") &&
                  retryCountRef.current < MAX_RETRIES
                ) {
                  const delay = RETRY_DELAYS[retryCountRef.current] || 8000;
                  retryCountRef.current++;
                  const seconds = Math.ceil(delay / 1000);
                  setRetryCountdown(seconds);
                  setErrorType(errType);
                  setKaiThinking(`Error encountered. Retrying in ${seconds}s...`);

                  retryTimerRef.current = setTimeout(() => {
                    setRetryCountdown(null);
                    resetState();
                    hasStartedRef.current = false;
                    startStream(true);
                  }, delay);
                  return;
                }
                setError(errMsg);
                setErrorType(errType);
                break;
              }
              case "aborted": {
                const errMsg = data.message || "Analysis stream stopped";
                setBusyOperation("stock_analysis_stream", false);
                setError(errMsg);
                setErrorType("connection_lost");
                break;
              }
              default:
                break;
            }
          },
          {
            signal: abortControllerRef.current.signal,
            idleTimeoutMs: 360000,
            requireTerminal: true,
          }
        );
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log("Stream aborted by user");
          setBusyOperation("stock_analysis_stream", false);
          return;
        }

        console.error("Stream error:", err);
        const errMsg = err.message || "Connection failed";
        const errType = classifyError(null, errMsg);

        // Auto-retry for connection errors (once)
        if (errType === "connection_lost" && retryCountRef.current < 1) {
          retryCountRef.current++;
          setKaiThinking("Connection lost. Reconnecting...");
          retryTimerRef.current = setTimeout(() => {
            hasStartedRef.current = false;
            startStream(true);
          }, 2000);
          return;
        }

        setError(errMsg);
        setErrorType(errType);
        setBusyOperation("stock_analysis_stream", false);
      } finally {
        setLoading(false);
      }
    },
    [ticker, userId, vaultOwnerToken, vaultKey, riskProfileProp, updateAgentState, resetState, setBusyOperation, onDecisionSaved]
  );

  // Effect to start stream on mount
  useEffect(() => {
    startStream();

    // Keep analysis stream alive when app/tab is backgrounded; abort only on explicit unload.
    const abortStream = () => abortControllerRef.current?.abort();
    window.addEventListener('beforeunload', abortStream);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
      window.removeEventListener('beforeunload', abortStream);
      setBusyOperation("stock_analysis_stream", false);
    };
  }, [startStream, setBusyOperation]);

  // -------------- RENDER ----------------

  // Error state with classified display
  if (error) {
    const display = getErrorDisplay(errorType, retryCountdown ?? undefined);
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 space-y-4">
        <div className="max-w-md w-full">
          <MorphyCard showRipple={false}>
            <MorphyCardContent className="p-8 flex flex-col items-center space-y-4">
            <div className="p-4 rounded-full bg-muted/30">{display.icon}</div>
            <h3 className="text-lg font-semibold text-center">{display.title}</h3>
            <p className="text-sm text-muted-foreground text-center">{error}</p>
            {retryCountdown !== null && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon icon={Loader2} size="sm" className="animate-spin" />
                <span>Retrying in {retryCountdown}s...</span>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <MorphyButton
                variant="none"
                effect="fade"
                size="sm"
                showRipple={false}
                onClick={onClose}
              >
                Close
              </MorphyButton>
              {errorType !== "auth_expired" && (
                <MorphyButton
                  size="sm"
                  onClick={() => {
                    retryCountRef.current = 0;
                    resetState();
                    hasStartedRef.current = false;
                    startStream();
                  }}
                >
                  <Icon icon={RefreshCw} size="sm" className="mr-2" /> Retry
                </MorphyButton>
              )}
              {errorType === "auth_expired" && (
                <MorphyButton size="sm" onClick={onClose}>
                  <Icon icon={ShieldAlert} size="sm" className="mr-2" /> Re-authenticate
                </MorphyButton>
              )}
            </div>
            </MorphyCardContent>
          </MorphyCard>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-transparent">
      {showHeader ? (
        <div className="relative z-10 mb-4 overflow-hidden rounded-2xl border border-border/50 bg-background/65 px-4 py-3 shadow-sm backdrop-blur-md">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div />
            <h1 className="justify-self-center text-3xl font-black tracking-tighter text-foreground">
              {normalizedTicker}
            </h1>
            <div className="justify-self-end flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                {formatHeaderPrice(headerPrice)}
              </span>
              {headerChangePct !== null ? (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                    headerChangePct >= 0
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  )}
                >
                  {headerChangePct >= 0 ? "+" : ""}
                  {headerChangePct.toFixed(2)}%
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Today N/A</span>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              {decision ? (
                <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold">
                  <Icon icon={CheckCircle2} size={12} className="mr-1" /> Complete
                </Badge>
              ) : loading && kaiThinking ? (
                <Badge
                  variant="outline"
                  className="max-w-[260px] truncate text-[10px] bg-primary/10 text-primary border-primary/30 font-medium"
                >
                  <Icon icon={Loader2} size={12} className="mr-1 animate-spin" /> {kaiThinking}
                </Badge>
              ) : retryCountdown !== null ? (
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                  Retry in {retryCountdown}s
                </Badge>
              ) : null}
            </div>
            <MorphyButton
              variant="none"
              effect="fade"
              size="sm"
              showRipple={false}
              onClick={handleClose}
            >
              <Icon icon={X} size="xs" />
              Cancel
            </MorphyButton>
          </div>
          {!decision && loading ? (
            <div className="mt-3">
              <Progress value={overallProgress} className="h-1.5 rounded-full" />
              <p className="mt-1 text-center text-[10px] text-muted-foreground">{progressLabel}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <ScrollArea className={cn("flex-1 p-4", !showHeader && "pt-0")}>
        <div className="mx-auto w-full max-w-3xl space-y-6 px-1 pb-10 sm:px-4">
          {decision ? (
            <MorphyCard>
              <MorphyCardContent className="p-0">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  Debate complete.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use Summary or Detailed View tabs to review the recommendation outputs.
                </p>
              </MorphyCardContent>
            </MorphyCard>
          ) : (
            <MorphyCard>
              <MorphyCardContent className="p-0">
                <p className="text-sm font-medium">Final recommendation is building...</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Debate rounds stream here. Switch tabs anytime; this run continues in the background.
                </p>
              </MorphyCardContent>
            </MorphyCard>
          )}

          {!decision ? (
            <RoundTabsCard
              roundNumber={1}
              title="Initial Deep Analysis"
              description="Agents analyze raw data independently."
              isCollapsed={collapsedRounds[1] || false}
              onToggleCollapse={() => setCollapsedRounds((prev) => ({ ...prev, 1: !prev[1] }))}
              activeAgent={activeRound === 1 ? activeAgent : undefined}
              agentStates={round1States}
              onTabChange={setActiveAgent}
            />
          ) : null}

          {!decision &&
          (activeRound >= 2 || AGENTS.some((agent) => round2States[agent]?.stage !== "idle")) ? (
            <RoundTabsCard
              roundNumber={2}
              title="Strategic Debate"
              description="Agents challenge and refine positions."
              isCollapsed={collapsedRounds[2] || false}
              onToggleCollapse={() => setCollapsedRounds((prev) => ({ ...prev, 2: !prev[2] }))}
              activeAgent={activeRound === 2 ? activeAgent : undefined}
              agentStates={round2States}
              onTabChange={setActiveAgent}
            />
          ) : null}

          {decision ? (
            <>
              <RoundTabsCard
                roundNumber={1}
                title="Initial Deep Analysis"
                description="Agents analyze raw data independently."
                isCollapsed={collapsedRounds[1] ?? true}
                onToggleCollapse={() => setCollapsedRounds((prev) => ({ ...prev, 1: !prev[1] }))}
                activeAgent={undefined}
                agentStates={round1States}
                onTabChange={setActiveAgent}
              />
              <RoundTabsCard
                roundNumber={2}
                title="Strategic Debate"
                description="Agents challenge and refine positions."
                isCollapsed={collapsedRounds[2] ?? true}
                onToggleCollapse={() => setCollapsedRounds((prev) => ({ ...prev, 2: !prev[2] }))}
                activeAgent={undefined}
                agentStates={round2States}
                onTabChange={setActiveAgent}
              />
            </>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
