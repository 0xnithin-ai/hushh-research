"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ChartColumnIncreasing,
  Cpu,
  LineChart,
  Percent,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { HeroStrip } from "@/components/kai/home/hero-strip";
import { NewsTape } from "@/components/kai/home/news-tape";
import { ConnectPortfolioCta } from "@/components/kai/cards/connect-portfolio-cta";
import { MarketOverviewGrid, type MarketOverviewMetric } from "@/components/kai/cards/market-overview-grid";
import { SpotlightCard } from "@/components/kai/cards/spotlight-card";
import { ThemeFocusList, type ThemeFocusItem } from "@/components/kai/cards/theme-focus-list";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/lib/morphy-ux/button";
import { Card, CardContent } from "@/lib/morphy-ux/card";
import { CacheService, CACHE_KEYS } from "@/lib/services/cache-service";
import { ensureKaiVaultOwnerToken } from "@/lib/services/kai-token-guard";
import { ApiService, type KaiHomeInsightsV2 } from "@/lib/services/api-service";
import { UnlockWarmOrchestrator } from "@/lib/services/unlock-warm-orchestrator";
import { useVault } from "@/lib/vault/vault-context";

function SectionLabel({ children }: { children: string }) {
  return (
    <h2 className="mb-3 pl-1 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </h2>
  );
}

const POLL_INTERVAL_MS = 600_000;
const MIN_REQUEST_GAP_MS = 2_500;
const MARKET_HOME_CACHE_TTL_MS = 600_000;
const SESSION_KAI_HOME_TTL_MS = 600_000;
const TICKER_CANDIDATE_RE = /^[A-Z][A-Z0-9.-]{0,5}$/;
const EXCLUDED_SYMBOLS = new Set([
  "CASH",
  "MMF",
  "SWEEP",
  "QACDS",
  "BUY",
  "SELL",
  "REINVEST",
  "DIVIDEND",
  "INTEREST",
  "TRANSFER",
  "WITHDRAWAL",
  "DEPOSIT",
]);

const THEME_ICON_MAP: Array<{ test: RegExp; icon: LucideIcon }> = [
  { test: /ai|chip|semi|data|cloud|infra/i, icon: Cpu },
  { test: /rate|yield|inflation|macro/i, icon: Percent },
  { test: /energy|oil|gas|renewable|power/i, icon: Zap },
];

function toSpotlightDecision(input: string | undefined): "BUY" | "HOLD" | "REDUCE" {
  const text = String(input || "").trim().toUpperCase();
  if (text === "BUY" || text === "STRONG_BUY") return "BUY";
  if (text === "REDUCE" || text === "SELL") return "REDUCE";
  return "HOLD";
}

function formatSpotlightPrice(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Price unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatOverviewValue(value: string | number | null | undefined): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Math.abs(value) >= 1000) {
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
    }
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  }
  if (typeof value === "string" && value.trim()) return value;
  return "Unavailable";
}

function formatOverviewDelta(deltaPct: number | null | undefined): string {
  if (typeof deltaPct !== "number" || !Number.isFinite(deltaPct)) return "N/A";
  const sign = deltaPct >= 0 ? "+" : "";
  return `${sign}${deltaPct.toFixed(2)}%`;
}

function toOverviewTone(deltaPct: number | null | undefined): MarketOverviewMetric["tone"] {
  if (typeof deltaPct !== "number" || !Number.isFinite(deltaPct)) return "neutral";
  if (deltaPct > 0.25) return "positive";
  if (deltaPct < -0.25) return "negative";
  return "neutral";
}

function iconForOverview(label: string, tone: MarketOverviewMetric["tone"]): LucideIcon {
  const lower = label.toLowerCase();
  if (lower.includes("volatility") || lower.includes("vix")) return Activity;
  if (lower.includes("yield") || lower.includes("rate")) return ChartColumnIncreasing;
  if (tone === "positive") return TrendingUp;
  if (tone === "negative") return TrendingDown;
  return LineChart;
}

function toOverviewMetrics(payload: KaiHomeInsightsV2 | null): MarketOverviewMetric[] {
  const rows = payload?.market_overview || [];
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row): row is NonNullable<KaiHomeInsightsV2["market_overview"]>[number] => Boolean(row))
    .map((row, idx) => {
      const tone = toOverviewTone(row.delta_pct);
      const label = String(row.label || `Metric ${idx + 1}`);
      return {
        id: `${label}-${idx}`,
        label,
        value: formatOverviewValue(row.value),
        delta: formatOverviewDelta(row.delta_pct),
        tone,
        icon: iconForOverview(label, tone),
      };
    })
    .slice(0, 4);
}

function toThemeIcon(title: string): LucideIcon {
  const matched = THEME_ICON_MAP.find((row) => row.test.test(title));
  return matched?.icon || LineChart;
}

function toThemeItems(payload: KaiHomeInsightsV2 | null): ThemeFocusItem[] {
  const themes = payload?.themes || [];
  if (!Array.isArray(themes)) return [];
  return themes
    .filter((theme): theme is NonNullable<KaiHomeInsightsV2["themes"]>[number] => Boolean(theme))
    .map((theme, idx) => ({
      id: `${String(theme.title || "theme")}-${idx}`,
      title: String(theme.title || "Theme"),
      subtitle: String(theme.subtitle || "Sector focus"),
      icon: toThemeIcon(String(theme.title || "")),
    }))
    .slice(0, 3);
}

function readAnyKaiHomeCache(cache: CacheService, userId: string, daysBack = 7): KaiHomeInsightsV2 | null {
  const prefix = `kai_market_home_${userId}_`;
  const suffix = `_${daysBack}`;
  const keys = cache
    .getStats()
    .keys.filter((key) => key.startsWith(prefix) && key.endsWith(suffix));

  for (const key of keys) {
    const value = cache.get<KaiHomeInsightsV2>(key);
    if (value) return value;
  }
  return null;
}

function readCachedPortfolioHoldings(
  cache: CacheService,
  userId: string
): Array<Record<string, unknown>> {
  const cachedPortfolio = cache.get<Record<string, unknown>>(CACHE_KEYS.PORTFOLIO_DATA(userId));
  return (
    (Array.isArray(cachedPortfolio?.holdings) && cachedPortfolio.holdings) ||
    (Array.isArray(cachedPortfolio?.detailed_holdings) && cachedPortfolio.detailed_holdings) ||
    []
  ) as Array<Record<string, unknown>>;
}

export function KaiMarketPreviewView() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const {
    vaultKey,
    tokenExpiresAt,
    unlockVault,
    getVaultOwnerToken,
    vaultOwnerToken,
  } = useVault();

  const [payload, setPayload] = useState<KaiHomeInsightsV2 | null>(null);
  const [, setLoadingInitial] = useState(true);
  const [, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const hasPayloadRef = useRef(false);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const lastStartedAtRef = useRef(0);

  const resolveToken = useCallback(
    async (forceRefresh = false): Promise<string> => {
      if (!user?.uid) {
        throw new Error("Missing authenticated user");
      }
      return ensureKaiVaultOwnerToken({
        userId: user.uid,
        currentToken: getVaultOwnerToken() ?? vaultOwnerToken,
        currentExpiresAt: tokenExpiresAt,
        forceRefresh,
        onIssued: (issuedToken, expiresAt) => {
          if (vaultKey) {
            unlockVault(vaultKey, issuedToken, expiresAt);
          }
        },
      });
    },
    [getVaultOwnerToken, tokenExpiresAt, unlockVault, user?.uid, vaultKey, vaultOwnerToken]
  );

  const resolveTrackedSymbols = useCallback(() => {
    if (!user?.uid) return [];
    const cache = CacheService.getInstance();
    const sourceHoldings = readCachedPortfolioHoldings(cache, user.uid);

    return sourceHoldings
      .filter((holding) => {
        const assetType = String(holding.asset_type || "").trim().toLowerCase();
        const name = String(holding.name || "").trim().toLowerCase();
        if (assetType.includes("cash") || assetType.includes("sweep")) return false;
        if (name.includes("cash") || name.includes("sweep")) return false;
        return true;
      })
      .map((holding) => String(holding.symbol || "").trim().toUpperCase())
      .filter(
        (symbol, index, arr) =>
          Boolean(symbol) &&
          !EXCLUDED_SYMBOLS.has(symbol) &&
          !symbol.startsWith("HOLDING_") &&
          TICKER_CANDIDATE_RE.test(symbol) &&
          arr.indexOf(symbol) === index
      )
      .slice(0, 8);
  }, [user?.uid]);

  const sessionCacheKey = useMemo(() => {
    if (!user?.uid) return null;
    return `kai_market_home_session_${user.uid}`;
  }, [user?.uid]);

  const loadInsights = useCallback(
    async ({ forceTokenRefresh = false, manual = false }: { forceTokenRefresh?: boolean; manual?: boolean } = {}) => {
      if (loading || !user?.uid) {
        return;
      }

      const cache = CacheService.getInstance();
      const trackedSymbols = resolveTrackedSymbols();
      const symbolsKey = trackedSymbols.length > 0 ? trackedSymbols.join("-") : "default";
      const marketCacheKey = CACHE_KEYS.KAI_MARKET_HOME(user.uid, symbolsKey, 7);
      if (!forceTokenRefresh && marketCacheKey) {
        const cachedPayload = cache.get<KaiHomeInsightsV2>(marketCacheKey);
        if (cachedPayload) {
          setPayload(cachedPayload);
          hasPayloadRef.current = true;
          setLoadingInitial(false);
          return;
        }
      }

      if (!forceTokenRefresh) {
        const anyCachedPayload = readAnyKaiHomeCache(cache, user.uid, 7);
        if (anyCachedPayload) {
          setPayload(anyCachedPayload);
          hasPayloadRef.current = true;
          setLoadingInitial(false);
          return;
        }
      }

      if (!forceTokenRefresh && sessionCacheKey && typeof window !== "undefined") {
        try {
          const raw = window.sessionStorage.getItem(sessionCacheKey);
          if (raw) {
            const parsed = JSON.parse(raw) as {
              payload?: KaiHomeInsightsV2;
              savedAt?: number;
            };
            const savedAt = Number(parsed?.savedAt || 0);
            const age = Date.now() - savedAt;
            const canUseSession =
              age >= 0 && age <= SESSION_KAI_HOME_TTL_MS && Boolean(parsed?.payload);
            if (canUseSession) {
              setPayload(parsed.payload as KaiHomeInsightsV2);
              hasPayloadRef.current = true;
              setLoadingInitial(false);
              return;
            }
          }
        } catch {
          // Ignore malformed session cache.
        }
      }

      if (!forceTokenRefresh && trackedSymbols.length === 0) {
        await UnlockWarmOrchestrator.awaitInFlightForUser(user.uid, 1_800);
        const warmedPayload =
          cache.get<KaiHomeInsightsV2>(marketCacheKey) ?? readAnyKaiHomeCache(cache, user.uid, 7);
        if (warmedPayload) {
          setPayload(warmedPayload);
          hasPayloadRef.current = true;
          setLoadingInitial(false);
          return;
        }
      }

      if (inFlightRef.current) {
        return inFlightRef.current;
      }
      const now = Date.now();
      if (!forceTokenRefresh && now - lastStartedAtRef.current < MIN_REQUEST_GAP_MS) {
        return;
      }
      lastStartedAtRef.current = now;

      const run = (async () => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        if (!hasPayloadRef.current) {
          setLoadingInitial(true);
        }
        if (manual || hasPayloadRef.current) {
          setRefreshing(true);
        }
        setError(null);

        try {
          let token = await resolveToken(forceTokenRefresh);
          let nextPayload: KaiHomeInsightsV2;

          try {
            nextPayload = await ApiService.getKaiMarketInsights({
              userId: user.uid,
              vaultOwnerToken: token,
              symbols: trackedSymbols,
              daysBack: 7,
              signal: controller.signal,
            });
          } catch (firstError) {
            if (controller.signal.aborted) return;
            token = await resolveToken(true);
            nextPayload = await ApiService.getKaiMarketInsights({
              userId: user.uid,
              vaultOwnerToken: token,
              symbols: trackedSymbols,
              daysBack: 7,
              signal: controller.signal,
            });
            if (firstError instanceof Error) {
              console.warn("[KaiMarketPreviewView] Retried insights fetch after token refresh", firstError.message);
            }
          }

          if (controller.signal.aborted) return;
          setPayload(nextPayload);
          hasPayloadRef.current = true;
          cache.set(marketCacheKey, nextPayload, MARKET_HOME_CACHE_TTL_MS);
          if (sessionCacheKey && typeof window !== "undefined") {
            window.sessionStorage.setItem(
              sessionCacheKey,
              JSON.stringify({ payload: nextPayload, savedAt: Date.now() })
            );
          }
        } catch (loadError) {
          if (controller.signal.aborted) return;
          const message = loadError instanceof Error ? loadError.message : "Failed to load live market insights";
          setError(message);
        } finally {
          if (!controller.signal.aborted) {
            setLoadingInitial(false);
            setRefreshing(false);
          }
        }
      })();

      inFlightRef.current = run;
      try {
        await run;
      } finally {
        if (inFlightRef.current === run) {
          inFlightRef.current = null;
        }
      }
    },
    [loading, resolveToken, resolveTrackedSymbols, sessionCacheKey, user?.uid]
  );

  useEffect(() => {
    if (loading || !user?.uid) return;

    void loadInsights();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadInsights();
      }
    };

    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadInsights();
      }
    }, POLL_INTERVAL_MS);

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      abortRef.current?.abort();
    };
  }, [loadInsights, loading, user?.uid]);

  const hasPayload = Boolean(payload);
  const overviewMetrics = useMemo(() => toOverviewMetrics(payload), [payload]);
  const themeItems = useMemo(() => toThemeItems(payload), [payload]);
  const spotlightRows = useMemo(
    () =>
      Array.isArray(payload?.spotlights)
        ? payload.spotlights.filter((row) => Boolean(row?.symbol)).slice(0, 2)
        : [],
    [payload?.spotlights]
  );
  const scenarioSignal = useMemo(
    () => (Array.isArray(payload?.signals) ? payload.signals[0] : undefined),
    [payload?.signals]
  );
  const showConnectPortfolio = useMemo(() => {
    if (!hasPayload) return false;
    const count = Number(payload?.hero?.holdings_count ?? 0);
    return !Number.isFinite(count) || count <= 0;
  }, [hasPayload, payload?.hero?.holdings_count]);

  return (
    <div className="mx-auto w-full max-w-[390px] px-4 py-7 pb-[calc(148px+var(--app-bottom-inset))]">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-black tracking-tight leading-tight">Explore the market with Kai</h1>
        <p className="mx-auto max-w-[22rem] text-sm text-muted-foreground">
          Structured insights, even before connecting your portfolio.
        </p>
      </header>

      <section className="mt-6">
        <HeroStrip
          onOpenDashboard={() => router.push("/kai/dashboard")}
        />
      </section>

      {error ? (
        <section className="mt-7">
          <Card variant="muted" effect="fill" className="rounded-xl p-0">
            <CardContent className="space-y-3 p-4 text-left">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-sm font-semibold">
                  {hasPayload ? "Failed to refresh market home" : "Failed to load market home"}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">{error}</p>
              <Button variant="none" effect="fade" size="sm" onClick={() => void loadInsights({ manual: true })}>
                Retry
              </Button>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="mt-10">
        <SectionLabel>Today's Spotlight</SectionLabel>
        {spotlightRows.length > 0 ? (
          <div className="space-y-3">
            {spotlightRows.map((row) => (
              <SpotlightCard
                key={row.symbol}
                title={String(row.company_name || row.symbol || "Unknown")}
                price={formatSpotlightPrice(row.price)}
                decision={toSpotlightDecision(row.recommendation)}
                summary={String(
                  row.recommendation_detail || row.headline || "No recommendation detail available."
                )}
                context={String(row.headline || "Real-time watchlist context")}
              />
            ))}
          </div>
        ) : (
          <Card variant="muted" effect="fill" className="rounded-xl p-0">
            <CardContent className="p-4 text-sm text-muted-foreground">
              No spotlight insights are available right now.
            </CardContent>
          </Card>
        )}
      </section>

      <section className="mt-10">
        <SectionLabel>Market Overview</SectionLabel>
        <MarketOverviewGrid metrics={overviewMetrics} />
      </section>

      <section className="mt-10">
        <SectionLabel>Scenario Simulation</SectionLabel>
        {scenarioSignal ? (
          <Card variant="muted" effect="fill" className="rounded-xl p-0">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold">{scenarioSignal.title}</p>
                <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {Number.isFinite(scenarioSignal.confidence)
                    ? `${(scenarioSignal.confidence * 100).toFixed(0)}% conf.`
                    : "Signal"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{scenarioSignal.summary}</p>
            </CardContent>
          </Card>
        ) : (
          <Card variant="muted" effect="fill" className="rounded-xl p-0">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Scenario insight is unavailable at the moment.
            </CardContent>
          </Card>
        )}
      </section>

      <section className="mt-10">
        <SectionLabel>Themes In Focus</SectionLabel>
        <ThemeFocusList themes={themeItems} />
      </section>

      <section className="mt-10">
        <SectionLabel>News</SectionLabel>
        <NewsTape rows={payload?.news_tape || []} />
      </section>

      {showConnectPortfolio ? (
        <section className="mt-10">
          <ConnectPortfolioCta />
        </section>
      ) : null}
    </div>
  );
}
