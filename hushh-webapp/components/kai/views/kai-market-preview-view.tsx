"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ChartColumnIncreasing,
  Cpu,
  LineChart,
  Loader2,
  Percent,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
  Zap,
} from "lucide-react";

import { NewsTape } from "@/components/kai/home/news-tape";
import { ConnectPortfolioCta } from "@/components/kai/cards/connect-portfolio-cta";
import { MarketOverviewGrid, type MarketOverviewMetric } from "@/components/kai/cards/market-overview-grid";
import { RenaissanceMarketList } from "@/components/kai/cards/renaissance-market-list";
import { SpotlightCard } from "@/components/kai/cards/spotlight-card";
import { ThemeFocusList, type ThemeFocusItem } from "@/components/kai/cards/theme-focus-list";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/lib/morphy-ux/button";
import { Card, CardContent } from "@/lib/morphy-ux/card";
import { CacheService, CACHE_KEYS } from "@/lib/services/cache-service";
import { ensureKaiVaultOwnerToken } from "@/lib/services/kai-token-guard";
import { ApiService, type KaiHomeInsightsV2 } from "@/lib/services/api-service";
import { UnlockWarmOrchestrator } from "@/lib/services/unlock-warm-orchestrator";
import { getSessionItem, isNativePlatform, setSessionItem } from "@/lib/utils/session-storage";
import { useVault } from "@/lib/vault/vault-context";

function SectionLabel({ children }: { children: string }) {
  return (
    <h2 className="app-section-heading mb-3 pl-1 uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </h2>
  );
}

const POLL_INTERVAL_MS = 600_000;
const MIN_REQUEST_GAP_MS = 2_500;
const MARKET_HOME_CACHE_TTL_MS = 600_000;
const SESSION_KAI_HOME_TTL_MS = 600_000;
const LAST_KNOWN_MARKET_HOME_TTL_MS = 7 * 24 * 60 * 60 * 1000;
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

function toSymbolsKey(symbols: string[]): string {
  if (!Array.isArray(symbols) || symbols.length === 0) return "default";
  return [...symbols].sort((a, b) => a.localeCompare(b)).join("-");
}

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

function isWeakSpotlightDetail(input: string | null | undefined): boolean {
  const text = String(input || "").trim().toLowerCase();
  if (!text) return true;
  return (
    text.includes("no live recommendation feed available") ||
    text.includes("recommendation unavailable") ||
    text.includes("target consensus unavailable")
  );
}

function toSafeHttpUrl(input: string | null | undefined): string | null {
  const text = String(input || "").trim();
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) return null;
  return text;
}

function summarizeSpotlight(row: NonNullable<KaiHomeInsightsV2["spotlights"]>[number]): string {
  const story = String(row.story || "").trim();
  if (story) return story;

  const detail = String(row.recommendation_detail || "").trim();
  if (detail && !isWeakSpotlightDetail(detail)) return detail;

  const headline = String(row.headline || "").trim();
  if (headline) return `Recent coverage: ${headline}`;

  const decision = toSpotlightDecision(row.recommendation);
  const changePct =
    typeof row.change_pct === "number" && Number.isFinite(row.change_pct)
      ? `${row.change_pct >= 0 ? "+" : ""}${row.change_pct.toFixed(2)}% today`
      : null;
  if (decision === "BUY") {
    return changePct
      ? `Momentum is positive (${changePct}) while analyst updates refresh.`
      : "Momentum is positive while analyst updates refresh.";
  }
  if (decision === "REDUCE") {
    return changePct
      ? `Momentum is soft (${changePct}) while analyst updates refresh.`
      : "Momentum is soft while analyst updates refresh.";
  }
  return changePct
    ? `Price action is mixed (${changePct}) while analyst updates refresh.`
    : "Price action is mixed while analyst updates refresh.";
}

function spotlightContextLabel(row: NonNullable<KaiHomeInsightsV2["spotlights"]>[number]): string {
  const source = String(row.headline_source || "").trim();
  if (source) return source;
  const recommendationSource = String(row.recommendation_source || "").trim();
  if (recommendationSource) return recommendationSource;
  return "Market signal feed";
}

function spotlightConfidenceLabel(
  row: NonNullable<KaiHomeInsightsV2["spotlights"]>[number]
): string | null {
  const value = row.confidence;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return `${pct}% confidence`;
}

function formatSpotlightPrice(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Price unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function isUnavailableText(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized === "n/a" ||
    normalized === "na" ||
    normalized === "unknown" ||
    normalized === "unavailable" ||
    normalized === "none" ||
    normalized === "null" ||
    normalized === "--" ||
    normalized === "-"
  );
}

function normalizeOverviewSource(source: string | null | undefined): string | null {
  if (!source) return null;
  const text = source.trim();
  if (!text || isUnavailableText(text)) return null;
  return text;
}

function formatOverviewValue(
  value: string | number | null | undefined,
  {
    label,
    degraded,
  }: {
    label: string;
    degraded: boolean;
  }
): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Math.abs(value) >= 1000) {
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
    }
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  }
  if (typeof value === "string" && value.trim() && !isUnavailableText(value)) return value;
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes("market status")) {
    return degraded ? "Status delayed" : "Updating status";
  }
  if (lowerLabel.includes("volatility") || lowerLabel.includes("vix")) {
    return degraded ? "Volatility delayed" : "Updating volatility";
  }
  return degraded ? "Data delayed" : "Updating";
}

function formatOverviewDelta(
  deltaPct: number | null | undefined,
  {
    label,
    source,
    degraded,
  }: {
    label: string;
    source: string | null | undefined;
    degraded: boolean;
  }
): string {
  if (typeof deltaPct !== "number" || !Number.isFinite(deltaPct)) {
    const lowerLabel = label.toLowerCase();
    const normalizedSource = normalizeOverviewSource(source);
    if (lowerLabel.includes("market status")) {
      return degraded ? "Schedule fallback" : "Live session";
    }
    if (normalizedSource) {
      return degraded ? `${normalizedSource} delayed` : normalizedSource;
    }
    return degraded ? "Data delayed" : "Live";
  }
  const sign = deltaPct >= 0 ? "+" : "";
  return `${sign}${deltaPct.toFixed(2)}%`;
}

function toOverviewTone(
  deltaPct: number | null | undefined,
  degraded: boolean
): MarketOverviewMetric["tone"] {
  if (typeof deltaPct !== "number" || !Number.isFinite(deltaPct)) {
    return degraded ? "warning" : "neutral";
  }
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
      const tone = toOverviewTone(row.delta_pct, Boolean(row.degraded));
      const label = String(row.label || `Metric ${idx + 1}`);
      return {
        id: `${label}-${idx}`,
        label,
        value: formatOverviewValue(row.value, {
          label,
          degraded: Boolean(row.degraded),
        }),
        delta: formatOverviewDelta(row.delta_pct, {
          label,
          source: row.source,
          degraded: Boolean(row.degraded),
        }),
        tone,
        icon: iconForOverview(label, tone),
      };
    })
    .slice(0, 4);
}

function hasUsefulOverviewValue(value: string | number | null | undefined): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") {
    const text = value.trim();
    return Boolean(text) && !isUnavailableText(text);
  }
  return false;
}

function countUsableOverviewRows(payload: KaiHomeInsightsV2 | null | undefined): number {
  const rows = payload?.market_overview;
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((count, row) => {
    if (!row) return count;
    if (hasUsefulOverviewValue(row.value)) return count + 1;
    return count;
  }, 0);
}

function withStableOverviewFromCache(
  nextPayload: KaiHomeInsightsV2,
  cachedPayload: KaiHomeInsightsV2 | null
): KaiHomeInsightsV2 {
  const nextUsableCount = countUsableOverviewRows(nextPayload);
  const cachedUsableCount = countUsableOverviewRows(cachedPayload);
  if (nextUsableCount > 0 || cachedUsableCount === 0) {
    return nextPayload;
  }
  return {
    ...nextPayload,
    market_overview: cachedPayload?.market_overview ?? nextPayload.market_overview,
  };
}

function toThemeIcon(title: string): LucideIcon {
  const matched = THEME_ICON_MAP.find((row) => row.test.test(title));
  return matched?.icon || LineChart;
}

function isDummyTheme(
  theme: NonNullable<KaiHomeInsightsV2["themes"]>[number]
): boolean {
  const sourceTags = Array.isArray(theme.source_tags)
    ? theme.source_tags.map((tag) => String(tag || "").toLowerCase())
    : [];
  const hasFallbackTag = sourceTags.some((tag) =>
    tag.includes("fallback") || tag.includes("dummy")
  );
  const subtitle = String(theme.subtitle || "").trim().toLowerCase();
  const hasHeadline = Boolean(String(theme.headline || "").trim());
  return Boolean(theme.degraded) && (hasFallbackTag || (!hasHeadline && subtitle.includes("sector rotation")));
}

function toThemeItems(payload: KaiHomeInsightsV2 | null): ThemeFocusItem[] {
  const themes = payload?.themes || [];
  if (!Array.isArray(themes)) return [];
  return themes
    .filter((theme): theme is NonNullable<KaiHomeInsightsV2["themes"]>[number] => Boolean(theme))
    .filter((theme) => !isDummyTheme(theme))
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
  const nestedPortfolio =
    cachedPortfolio?.portfolio &&
    typeof cachedPortfolio.portfolio === "object" &&
    !Array.isArray(cachedPortfolio.portfolio)
      ? (cachedPortfolio.portfolio as Record<string, unknown>)
      : null;
  return (
    (Array.isArray(cachedPortfolio?.holdings) && cachedPortfolio.holdings) ||
    (Array.isArray(nestedPortfolio?.holdings) && nestedPortfolio.holdings) ||
    []
  ) as Array<Record<string, unknown>>;
}

export function KaiMarketPreviewView() {
  const { user, loading } = useAuth();
  const {
    vaultKey,
    tokenExpiresAt,
    unlockVault,
    getVaultOwnerToken,
    vaultOwnerToken,
  } = useVault();

  const [payload, setPayload] = useState<KaiHomeInsightsV2 | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 8);
  }, [user?.uid]);

  const sessionCacheKey = useMemo(() => {
    if (!user?.uid) return null;
    return `kai_market_home_session_${user.uid}`;
  }, [user?.uid]);

  const persistentCacheKey = useMemo(() => {
    if (!user?.uid) return null;
    return `kai_market_home_last_known_${user.uid}`;
  }, [user?.uid]);

  const loadInsights = useCallback(
    async ({ forceTokenRefresh = false, manual = false }: { forceTokenRefresh?: boolean; manual?: boolean } = {}) => {
      if (loading || !user?.uid) {
        return;
      }

      const cache = CacheService.getInstance();
      let trackedSymbols = resolveTrackedSymbols();
      let symbolsKey = toSymbolsKey(trackedSymbols);
      let marketCacheKey = CACHE_KEYS.KAI_MARKET_HOME(user.uid, symbolsKey, 7);
      let seededFromLocalCache = false;
      if (!forceTokenRefresh && marketCacheKey) {
        const cachedPayload = cache.get<KaiHomeInsightsV2>(marketCacheKey);
        if (cachedPayload) {
          setPayload(cachedPayload);
          hasPayloadRef.current = true;
          setLoadingInitial(false);
          seededFromLocalCache = true;
        }
      }

      if (!forceTokenRefresh && !seededFromLocalCache) {
        const anyCachedPayload = readAnyKaiHomeCache(cache, user.uid, 7);
        if (anyCachedPayload) {
          setPayload(anyCachedPayload);
          hasPayloadRef.current = true;
          setLoadingInitial(false);
          seededFromLocalCache = true;
        }
      }

      if (
        !forceTokenRefresh &&
        !seededFromLocalCache &&
        sessionCacheKey &&
        typeof window !== "undefined"
      ) {
        try {
          const raw = getSessionItem(sessionCacheKey);
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
              seededFromLocalCache = true;
            }
          }
        } catch {
          // Ignore malformed session cache.
        }
      }

      if (
        !forceTokenRefresh &&
        !seededFromLocalCache &&
        isNativePlatform &&
        persistentCacheKey &&
        typeof window !== "undefined"
      ) {
        try {
          const raw = getSessionItem(persistentCacheKey);
          if (raw) {
            const parsed = JSON.parse(raw) as {
              payload?: KaiHomeInsightsV2;
              savedAt?: number;
            };
            const savedAt = Number(parsed?.savedAt || 0);
            const age = Date.now() - savedAt;
            const canUsePersistent =
              age >= 0 &&
              age <= LAST_KNOWN_MARKET_HOME_TTL_MS &&
              Boolean(parsed?.payload);
            if (canUsePersistent) {
              setPayload(parsed.payload as KaiHomeInsightsV2);
              hasPayloadRef.current = true;
              setLoadingInitial(false);
              seededFromLocalCache = true;
            }
          }
        } catch {
          // Ignore malformed persistent cache.
        }
      }

      if (!forceTokenRefresh && !hasPayloadRef.current) {
        await UnlockWarmOrchestrator.awaitInFlightForUser(user.uid, 1_800);
        trackedSymbols = resolveTrackedSymbols();
        symbolsKey = toSymbolsKey(trackedSymbols);
        marketCacheKey = CACHE_KEYS.KAI_MARKET_HOME(user.uid, symbolsKey, 7);
        const warmedPayload =
          cache.get<KaiHomeInsightsV2>(marketCacheKey) ?? readAnyKaiHomeCache(cache, user.uid, 7);
        if (warmedPayload) {
          setPayload(warmedPayload);
          hasPayloadRef.current = true;
          setLoadingInitial(false);
          seededFromLocalCache = true;
        }
      }

      if (seededFromLocalCache && !manual && !forceTokenRefresh) {
        return;
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
          const fetchInsightsWithRetry = async (
            symbolsOverride?: string[]
          ): Promise<KaiHomeInsightsV2> => {
            try {
              return await ApiService.getKaiMarketInsights({
                userId: user.uid,
                vaultOwnerToken: token,
                symbols: symbolsOverride && symbolsOverride.length > 0 ? symbolsOverride : undefined,
                daysBack: 7,
                signal: controller.signal,
              });
            } catch (firstError) {
              if (controller.signal.aborted) throw firstError;
              token = await resolveToken(true);
              const retried = await ApiService.getKaiMarketInsights({
                userId: user.uid,
                vaultOwnerToken: token,
                symbols: symbolsOverride && symbolsOverride.length > 0 ? symbolsOverride : undefined,
                daysBack: 7,
                signal: controller.signal,
              });
              if (firstError instanceof Error) {
                console.warn(
                  "[KaiMarketPreviewView] Retried insights fetch after token refresh",
                  firstError.message
                );
              }
              return retried;
            }
          };

          let fallbackPayload: KaiHomeInsightsV2 | null = null;
          const hasTrackedSymbols = trackedSymbols.length > 0;
          let nextPayload: KaiHomeInsightsV2;
          try {
            nextPayload = await fetchInsightsWithRetry(hasTrackedSymbols ? trackedSymbols : undefined);
          } catch (targetedFetchError) {
            if (!hasPayloadRef.current && !manual && hasTrackedSymbols) {
              try {
                fallbackPayload = await fetchInsightsWithRetry(undefined);
                if (!controller.signal.aborted && fallbackPayload) {
                  setPayload(fallbackPayload);
                  hasPayloadRef.current = true;
                  cache.set(
                    CACHE_KEYS.KAI_MARKET_HOME(user.uid, "default", 7),
                    fallbackPayload,
                    MARKET_HOME_CACHE_TTL_MS
                  );
                  if (sessionCacheKey && typeof window !== "undefined") {
                    setSessionItem(
                      sessionCacheKey,
                      JSON.stringify({ payload: fallbackPayload, savedAt: Date.now() })
                    );
                  }
                  if (persistentCacheKey && typeof window !== "undefined") {
                    setSessionItem(
                      persistentCacheKey,
                      JSON.stringify({ payload: fallbackPayload, savedAt: Date.now() })
                    );
                  }
                  setLoadingInitial(false);
                }
              } catch (defaultFetchError) {
                if (defaultFetchError instanceof Error) {
                  console.warn(
                    "[KaiMarketPreviewView] Fallback default market fetch failed:",
                    defaultFetchError.message
                  );
                }
              }
            }
            if (!fallbackPayload) {
              throw targetedFetchError;
            }
            nextPayload = fallbackPayload;
          }

          if (controller.signal.aborted) return;
          const cachedBaselinePayload =
            cache.get<KaiHomeInsightsV2>(marketCacheKey) ??
            readAnyKaiHomeCache(cache, user.uid, 7);
          const stabilizedPayload = withStableOverviewFromCache(
            nextPayload,
            seededFromLocalCache ? cachedBaselinePayload : null
          );
          setPayload(stabilizedPayload);
          hasPayloadRef.current = true;
          cache.set(marketCacheKey, stabilizedPayload, MARKET_HOME_CACHE_TTL_MS);
          if (trackedSymbols.length === 0) {
            cache.set(CACHE_KEYS.KAI_MARKET_HOME(user.uid, "default", 7), stabilizedPayload, MARKET_HOME_CACHE_TTL_MS);
          }
          if (sessionCacheKey && typeof window !== "undefined") {
            setSessionItem(
              sessionCacheKey,
              JSON.stringify({ payload: stabilizedPayload, savedAt: Date.now() })
            );
          }
          if (persistentCacheKey && typeof window !== "undefined") {
            setSessionItem(
              persistentCacheKey,
              JSON.stringify({ payload: stabilizedPayload, savedAt: Date.now() })
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
    [loading, persistentCacheKey, resolveToken, resolveTrackedSymbols, sessionCacheKey, user?.uid]
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
  const renaissanceRows = useMemo(
    () =>
      Array.isArray(payload?.renaissance_list)
        ? payload.renaissance_list.filter((row) => Boolean(row?.symbol)).slice(0, 12)
        : [],
    [payload?.renaissance_list]
  );
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
    <div className="mx-auto w-full max-w-[390px] overflow-x-hidden px-4 pt-[var(--kai-view-top-gap,16px)] pb-6 md:max-w-3xl md:px-6 lg:max-w-5xl">
      <header className="space-y-2 text-center">
        <h1 className="text-[clamp(1.85rem,4.2vw,2.75rem)] font-black tracking-tight leading-tight">Explore the market with Kai</h1>
        <p className="mx-auto max-w-[22rem] text-sm text-muted-foreground md:max-w-2xl">
          Structured insights, even before connecting your portfolio.
        </p>
        {refreshing && hasPayload ? (
          <p className="text-xs text-muted-foreground">Refreshing live market data...</p>
        ) : null}
      </header>

      {loadingInitial && !hasPayload ? (
        <section className="mt-7">
          <Card variant="muted" effect="fill" className="rounded-xl p-0">
            <CardContent className="space-y-3 p-4 text-left">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <p className="text-sm font-semibold">Loading market snapshot...</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Restoring latest available market cache.
              </p>
            </CardContent>
          </Card>
        </section>
      ) : null}

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
                confidenceLabel={spotlightConfidenceLabel(row)}
                summary={summarizeSpotlight(row)}
                context={spotlightContextLabel(row)}
                contextHref={toSafeHttpUrl(row.headline_url)}
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
        <SectionLabel>Renaissance Core</SectionLabel>
        <RenaissanceMarketList rows={renaissanceRows} />
      </section>

      <section className="mt-10">
        <SectionLabel>News</SectionLabel>
        <NewsTape rows={payload?.news_tape || []} />
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

      {themeItems.length > 0 ? (
        <section className="mt-10">
          <SectionLabel>Themes In Focus</SectionLabel>
          <ThemeFocusList themes={themeItems} />
        </section>
      ) : null}

      {showConnectPortfolio ? (
        <section className="mt-10">
          <ConnectPortfolioCta />
        </section>
      ) : null}
    </div>
  );
}
