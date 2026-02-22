"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DebateStreamView } from "@/components/kai/debate-stream-view";
import { HushhLoader } from "@/components/app-ui/hushh-loader";
import { AnalysisHistoryDashboard } from "@/components/kai/views/analysis-history-dashboard";
import { AnalysisSummaryView } from "@/components/kai/views/analysis-summary-view";
import { HistoryDetailView } from "@/components/kai/views/history-detail-view";
import { Button } from "@/lib/morphy-ux/button";
import { useAuth } from "@/lib/firebase/auth-context";
import { KaiHistoryService, type AnalysisHistoryEntry } from "@/lib/services/kai-history-service";
import { useKaiSession } from "@/lib/stores/kai-session-store";
import { useVault } from "@/lib/vault/vault-context";

const ANALYSIS_INTENT_FRESH_MS = 15_000;
const ANALYSIS_TABS = ["history", "summary", "debate"] as const;
type AnalysisTab = (typeof ANALYSIS_TABS)[number];

function normalizeAnalysisTab(raw: string | null, hasDebateId: boolean): AnalysisTab {
  if (raw === "summary" || raw === "debate" || raw === "history") return raw;
  if (hasDebateId) return "summary";
  return "history";
}

function extractDebateId(entry: AnalysisHistoryEntry | null): string | null {
  if (!entry || typeof entry !== "object") return null;
  const rawCard = (entry.raw_card || {}) as Record<string, unknown>;
  const diagnostics = rawCard.stream_diagnostics as Record<string, unknown> | undefined;
  const streamId = diagnostics?.stream_id;
  if (typeof streamId === "string" && streamId.trim()) {
    return streamId.trim();
  }
  return null;
}

export default function KaiAnalysisPage() {
  const pageOpenedAtRef = useRef(Date.now());

  const router = useRouter();
  const searchParams = useSearchParams();

  const { user, userId } = useAuth();
  const { vaultKey, vaultOwnerToken } = useVault();

  const analysisParams = useKaiSession((s) => s.analysisParams);
  const analysisParamsUpdatedAt = useKaiSession((s) => s.analysisParamsUpdatedAt);
  const setAnalysisParams = useKaiSession((s) => s.setAnalysisParams);
  const setBusyOperation = useKaiSession((s) => s.setBusyOperation);

  const debateId = searchParams.get("debate_id");
  const activeTab = useMemo(
    () => normalizeAnalysisTab(searchParams.get("tab"), Boolean(debateId)),
    [debateId, searchParams]
  );

  const [resolvedEntry, setResolvedEntry] = useState<AnalysisHistoryEntry | null>(null);
  const [resolvingEntry, setResolvingEntry] = useState(false);

  const hasFreshAnalysisIntent =
    Boolean(analysisParams) &&
    Boolean(analysisParamsUpdatedAt) &&
    (analysisParamsUpdatedAt || 0) >= pageOpenedAtRef.current - ANALYSIS_INTENT_FRESH_MS;

  const liveIntentReady =
    hasFreshAnalysisIntent &&
    Boolean(analysisParams?.userId) &&
    analysisParams?.userId !== "__pending__";

  const setRouteState = useCallback(
    (tab: AnalysisTab, nextDebateId?: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      if (nextDebateId) {
        params.set("debate_id", nextDebateId);
      } else {
        params.delete("debate_id");
      }
      router.replace(`/kai/analysis?${params.toString()}`);
    },
    [router, searchParams]
  );

  useEffect(() => {
    const rawTab = searchParams.get("tab");
    const normalized = normalizeAnalysisTab(rawTab, Boolean(debateId));
    if (rawTab !== normalized) {
      setRouteState(normalized, debateId);
    }
  }, [debateId, searchParams, setRouteState]);

  useEffect(() => {
    if (!analysisParams) return;
    if (!userId) return;
    if (!analysisParams.userId || analysisParams.userId === "__pending__") {
      setAnalysisParams({
        ...analysisParams,
        userId,
      });
    }
  }, [analysisParams, setAnalysisParams, userId]);

  useEffect(() => {
    if (!analysisParams || !analysisParamsUpdatedAt) return;
    const isFresh = analysisParamsUpdatedAt >= pageOpenedAtRef.current - ANALYSIS_INTENT_FRESH_MS;
    if (!isFresh) {
      setAnalysisParams(null);
    }
  }, [analysisParams, analysisParamsUpdatedAt, setAnalysisParams]);

  useEffect(() => {
    setBusyOperation("stock_analysis_active", Boolean(liveIntentReady));
    return () => {
      setBusyOperation("stock_analysis_active", false);
    };
  }, [liveIntentReady, setBusyOperation]);

  useEffect(() => {
    if (!debateId || !userId || !vaultKey) {
      setResolvedEntry(null);
      setResolvingEntry(false);
      return;
    }
    const resolvedUserId = userId;
    const resolvedVaultKey = vaultKey;

    let cancelled = false;
    setResolvingEntry(true);

    async function resolveEntry() {
      try {
        const allHistory = await KaiHistoryService.getAllHistory({
          userId: resolvedUserId,
          vaultKey: resolvedVaultKey,
          vaultOwnerToken: vaultOwnerToken || "",
        });
        if (cancelled) return;

        const match = Object.values(allHistory)
          .flat()
          .find((entry) => extractDebateId(entry) === debateId);
        setResolvedEntry(match || null);
      } finally {
        if (!cancelled) {
          setResolvingEntry(false);
        }
      }
    }

    void resolveEntry();

    return () => {
      cancelled = true;
    };
  }, [debateId, userId, vaultKey, vaultOwnerToken]);

  const handleSelectTicker = useCallback(
    (ticker: string) => {
      if (!userId) return;
      setResolvedEntry(null);
      setAnalysisParams({
        ticker,
        userId,
        riskProfile: "balanced",
      });
      setRouteState("debate", null);
    },
    [setAnalysisParams, setRouteState, userId]
  );

  const handleViewHistory = useCallback(
    (entry: AnalysisHistoryEntry) => {
      setAnalysisParams(null);
      setResolvedEntry(entry);
      setRouteState("summary", extractDebateId(entry));
    },
    [setAnalysisParams, setRouteState]
  );

  const handleCloseLiveDebate = useCallback(() => {
    setAnalysisParams(null);
    setRouteState("history", null);
  }, [setAnalysisParams, setRouteState]);

  const handleBackToHistory = useCallback(() => {
    setAnalysisParams(null);
    setResolvedEntry(null);
    setRouteState("history", null);
  }, [setAnalysisParams, setRouteState]);

  const handleReanalyze = useCallback(
    (ticker: string) => {
      if (!userId) return;
      setResolvedEntry(null);
      setAnalysisParams({
        ticker,
        userId,
        riskProfile: "balanced",
      });
      setRouteState("debate", null);
    },
    [setAnalysisParams, setRouteState, userId]
  );

  const handleOpenDetailedDebate = useCallback(() => {
    if (!resolvedEntry) return;
    setRouteState("debate", extractDebateId(resolvedEntry));
  }, [resolvedEntry, setRouteState]);

  if (!user || !userId || !vaultKey) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <HushhLoader variant="inline" label="Preparing analysis hub…" />
      </div>
    );
  }

  return (
    <div className="pt-4">
      <div className="mx-auto mb-4 flex w-full max-w-4xl gap-1 px-4 sm:px-6">
        {ANALYSIS_TABS.map((tab) => (
          <Button
            key={tab}
            variant="none"
            effect={activeTab === tab ? "fill" : "fade"}
            size="sm"
            className="rounded-full capitalize"
            onClick={() => setRouteState(tab, tab === "history" ? null : debateId)}
          >
            {tab}
          </Button>
        ))}
      </div>

      {activeTab === "debate" && liveIntentReady && analysisParams ? (
        <DebateStreamView
          ticker={analysisParams.ticker}
          userId={analysisParams.userId}
          riskProfile={analysisParams.riskProfile}
          vaultOwnerToken={vaultOwnerToken || ""}
          vaultKey={vaultKey}
          onClose={handleCloseLiveDebate}
        />
      ) : null}

      {activeTab === "summary" && resolvedEntry ? (
        <AnalysisSummaryView
          entry={resolvedEntry}
          onBack={handleBackToHistory}
          onOpenDebate={handleOpenDetailedDebate}
          onReanalyze={handleReanalyze}
        />
      ) : null}

      {activeTab === "debate" && !liveIntentReady && resolvedEntry ? (
        <HistoryDetailView
          entry={resolvedEntry}
          onBack={handleBackToHistory}
          onReanalyze={handleReanalyze}
        />
      ) : null}

      {(activeTab === "history" || (!resolvedEntry && !liveIntentReady && !resolvingEntry)) ? (
        <div className="pt-2">
          <AnalysisHistoryDashboard
            userId={userId}
            vaultKey={vaultKey}
            vaultOwnerToken={vaultOwnerToken || ""}
            onSelectTicker={handleSelectTicker}
            onViewHistory={handleViewHistory}
          />
        </div>
      ) : null}

      {resolvingEntry ? (
        <div className="flex min-h-64 items-center justify-center">
          <HushhLoader variant="inline" label="Loading analysis record…" />
        </div>
      ) : null}
    </div>
  );
}
