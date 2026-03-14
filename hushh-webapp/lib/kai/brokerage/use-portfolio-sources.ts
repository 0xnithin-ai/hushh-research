"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { PortfolioData } from "@/components/kai/types/portfolio";
import { ROUTES } from "@/lib/navigation/routes";
import {
  hasPortfolioHoldings,
  resolveAvailableSources,
  resolvePortfolioFreshness,
  type PlaidPortfolioStatusResponse,
  type PortfolioFreshness,
  type PortfolioSource,
} from "@/lib/kai/brokerage/portfolio-sources";
import { AppBackgroundTaskService } from "@/lib/services/app-background-task-service";
import { PlaidPortfolioService } from "@/lib/kai/brokerage/plaid-portfolio-service";
import { WorldModelService } from "@/lib/services/world-model-service";
import { normalizeStoredPortfolio } from "@/lib/utils/portfolio-normalize";

interface UsePortfolioSourcesParams {
  userId: string | null | undefined;
  vaultOwnerToken?: string | null;
  vaultKey?: string | null;
  initialStatementPortfolio?: PortfolioData | null;
}

interface RefreshTracking {
  taskId: string;
  runIds: string[];
}

export interface UsePortfolioSourcesResult {
  isLoading: boolean;
  error: string | null;
  plaidStatus: PlaidPortfolioStatusResponse | null;
  statementPortfolio: PortfolioData | null;
  plaidPortfolio: PortfolioData | null;
  activeSource: PortfolioSource;
  availableSources: PortfolioSource[];
  activePortfolio: PortfolioData | null;
  freshness: PortfolioFreshness | null;
  changeActiveSource: (nextSource: PortfolioSource) => Promise<void>;
  refreshPlaid: (itemId?: string) => Promise<void>;
  reload: () => Promise<void>;
}

function pickPreferredSource(params: {
  preferred: PortfolioSource | string | null | undefined;
  availableSources: PortfolioSource[];
}): PortfolioSource {
  const preferred = params.preferred;
  if (
    (preferred === "statement" || preferred === "plaid") &&
    params.availableSources.includes(preferred)
  ) {
    return preferred;
  }
  if (params.availableSources.includes("statement")) return "statement";
  if (params.availableSources.includes("plaid")) return "plaid";
  return "statement";
}

export function usePortfolioSources({
  userId,
  vaultOwnerToken,
  vaultKey,
  initialStatementPortfolio = null,
}: UsePortfolioSourcesParams): UsePortfolioSourcesResult {
  const [statementPortfolio, setStatementPortfolio] = useState<PortfolioData | null>(
    initialStatementPortfolio
  );
  const [plaidStatus, setPlaidStatus] = useState<PlaidPortfolioStatusResponse | null>(null);
  const [activeSource, setActiveSource] = useState<PortfolioSource>("statement");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTracking, setRefreshTracking] = useState<RefreshTracking | null>(null);

  useEffect(() => {
    if (initialStatementPortfolio && hasPortfolioHoldings(initialStatementPortfolio)) {
      setStatementPortfolio(initialStatementPortfolio);
    }
  }, [initialStatementPortfolio]);

  const loadStatementPortfolio = useCallback(async (): Promise<PortfolioData | null> => {
    if (userId && vaultKey && vaultOwnerToken) {
      try {
        const fullBlob = await WorldModelService.loadFullBlob({
          userId,
          vaultKey,
          vaultOwnerToken: vaultOwnerToken || undefined,
        });
        const financial =
          fullBlob.financial &&
          typeof fullBlob.financial === "object" &&
          !Array.isArray(fullBlob.financial)
            ? (fullBlob.financial as Record<string, unknown>)
            : null;
        if (!financial) return null;
        const normalized = normalizeStoredPortfolio(financial) as PortfolioData;
        return hasPortfolioHoldings(normalized) ? normalized : null;
      } catch {
        return null;
      }
    }
    if (initialStatementPortfolio && hasPortfolioHoldings(initialStatementPortfolio)) {
      return initialStatementPortfolio;
    }
    return statementPortfolio && hasPortfolioHoldings(statementPortfolio) ? statementPortfolio : null;
  }, [initialStatementPortfolio, statementPortfolio, userId, vaultKey, vaultOwnerToken]);

  const reload = useCallback(async () => {
    if (!userId || !vaultOwnerToken) {
      startTransition(() => {
        setPlaidStatus(null);
        setIsLoading(false);
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [loadedStatement, loadedPlaidStatus] = await Promise.all([
        loadStatementPortfolio(),
        PlaidPortfolioService.getStatus({
          userId,
          vaultOwnerToken,
        }).catch(() => null),
      ]);

      startTransition(() => {
        setStatementPortfolio(loadedStatement);
        setPlaidStatus(loadedPlaidStatus);
        const plaidPortfolio = loadedPlaidStatus?.aggregate?.portfolio_data || null;
        const availableSources = resolveAvailableSources({
          statementPortfolio: loadedStatement,
          plaidPortfolio,
        });
        const preferred = loadedPlaidStatus?.source_preference || activeSource;
        setActiveSource(pickPreferredSource({ preferred, availableSources }));
      });
    } catch (loadError) {
      startTransition(() => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load portfolio sources.");
      });
    } finally {
      startTransition(() => {
        setIsLoading(false);
      });
    }
  }, [activeSource, loadStatementPortfolio, userId, vaultOwnerToken]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const plaidPortfolio = useMemo(
    () => plaidStatus?.aggregate?.portfolio_data || null,
    [plaidStatus]
  );

  const availableSources = useMemo(
    () =>
      resolveAvailableSources({
        statementPortfolio,
        plaidPortfolio,
      }),
    [plaidPortfolio, statementPortfolio]
  );

  useEffect(() => {
    setActiveSource((current) => pickPreferredSource({ preferred: current, availableSources }));
  }, [availableSources]);

  const freshness = useMemo(
    () => resolvePortfolioFreshness(plaidStatus),
    [plaidStatus]
  );

  const activePortfolio = useMemo(() => {
    if (activeSource === "statement") return statementPortfolio;
    return plaidPortfolio;
  }, [activeSource, plaidPortfolio, statementPortfolio]);

  const changeActiveSource = useCallback(
    async (nextSource: PortfolioSource) => {
      setActiveSource(nextSource);
      if (!userId || !vaultOwnerToken) return;
      await PlaidPortfolioService.setActiveSource({
        userId,
        activeSource: nextSource,
        vaultOwnerToken,
      });
    },
    [userId, vaultOwnerToken]
  );

  const refreshPlaid = useCallback(
    async (itemId?: string) => {
      if (!userId || !vaultOwnerToken) {
        throw new Error("Vault owner token missing.");
      }
      const response = await PlaidPortfolioService.refresh({
        userId,
        vaultOwnerToken,
        itemId,
      });
      const runIds = (response.runs || [])
        .map((run) => String(run.run_id || "").trim())
        .filter(Boolean);
      if (!runIds.length) {
        await reload();
        return;
      }
      const taskId = AppBackgroundTaskService.startTask({
        userId,
        kind: "plaid_refresh",
        title: "Refreshing Plaid portfolio",
        description: "Kai is syncing the latest brokerage data from Plaid.",
        routeHref: ROUTES.KAI_DASHBOARD,
      });
      setRefreshTracking({ taskId, runIds });
      await reload();
    },
    [reload, userId, vaultOwnerToken]
  );

  useEffect(() => {
    const runLookup = new Map(
      (plaidStatus?.items || [])
        .map((item) => item.latest_refresh_run)
        .filter(Boolean)
        .map((run) => [String(run?.run_id || ""), run] as const)
    );

    if (refreshTracking) {
      const trackedRuns = refreshTracking.runIds
        .map((runId) => runLookup.get(runId))
        .filter(Boolean);
      const allTerminal =
        trackedRuns.length > 0 &&
        trackedRuns.every((run) => {
          const status = String(run?.status || "");
          return status === "completed" || status === "failed";
        });
      if (allTerminal) {
        const anyFailed = trackedRuns.some((run) => String(run?.status || "") === "failed");
        if (anyFailed) {
          AppBackgroundTaskService.failTask(
            refreshTracking.taskId,
            "One or more Plaid connections failed to refresh.",
            "Plaid refresh finished with errors."
          );
        } else {
          AppBackgroundTaskService.completeTask(
            refreshTracking.taskId,
            "Plaid brokerage data is up to date."
          );
        }
        setRefreshTracking(null);
      }
    }

    const shouldPoll =
      Boolean(refreshTracking) ||
      Boolean(
        (plaidStatus?.items || []).some((item) => {
          const status = String(item.latest_refresh_run?.status || item.sync_status || "");
          return status === "queued" || status === "running";
        })
      );
    if (!shouldPoll) return;

    const timer = window.setInterval(() => {
      void reload();
    }, 5000);
    return () => {
      window.clearInterval(timer);
    };
  }, [plaidStatus, refreshTracking, reload]);

  return {
    isLoading,
    error,
    plaidStatus,
    statementPortfolio,
    plaidPortfolio,
    activeSource,
    availableSources,
    activePortfolio,
    freshness,
    changeActiveSource,
    refreshPlaid,
    reload,
  };
}
