"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Search,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/lib/morphy-ux/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
// Search is provided globally via Kai layout (bottom bar)
import {
  KaiHistoryService,
  type AnalysisHistoryEntry,
  type AnalysisHistoryMap,
} from "@/lib/services/kai-history-service";
import { DataTable } from "@/components/ui/data-table";
import { getColumns, type HistoryEntryWithVersion } from "./columns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

// ============================================================================
// Props
// ============================================================================

export interface AnalysisHistoryDashboardProps {
  userId: string;
  vaultKey: string;
  vaultOwnerToken?: string;
  onSelectTicker: (ticker: string) => void;
  onViewHistory: (entry: AnalysisHistoryEntry) => void;
}

// ============================================================================
// Helpers
// ============================================================================

/** Format ISO timestamp into a human-readable relative string */
function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;

  if (Number.isNaN(diffMs) || diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/** Map decision string to display color classes */
function decisionStyles(decision: string): {
  bg: string;
  text: string;
  border: string;
  icon: React.ReactNode;
} {
  const d = decision.toLowerCase();
  if (d === "buy") {
    return {
      bg: "bg-emerald-500/10",
      text: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-500/30",
      icon: <TrendingUp className="w-3 h-3" />,
    };
  }
  if (d === "reduce" || d === "sell") {
    return {
      bg: "bg-red-500/10",
      text: "text-red-600 dark:text-red-400",
      border: "border-red-500/30",
      icon: <TrendingDown className="w-3 h-3" />,
    };
  }
  // hold / other
  return {
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/30",
    icon: <Minus className="w-3 h-3" />,
  };
}

/**
 * Dedupe history table to one row per ticker.
 *
 * - We still compute a `version` for each entry (oldest=1 ... newest=N)
 * - The table shows ONLY the latest entry per ticker
 * - Older versions are accessible via the row action menu (handled in columns)
 */
function processHistory(map: AnalysisHistoryMap): HistoryEntryWithVersion[] {
  const latestPerTicker: HistoryEntryWithVersion[] = [];

  Object.entries(map).forEach(([ticker, entries]) => {
    if (!entries?.length) return;

    // Sort entries for this ticker by date ASC to assign version numbers
    const sortedByDateAsc = [...entries].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const withVersions: HistoryEntryWithVersion[] = sortedByDateAsc.map((entry, index) => ({
      ...entry,
      version: index + 1,
    }));

    // Latest is the newest timestamp
    const latest = withVersions[withVersions.length - 1];
    if (latest) latestPerTicker.push(latest);
  });

  // Sort tickers by latest analysis date DESC
  return latestPerTicker.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

// ============================================================================
// Skeleton Card
// ============================================================================

function HistoryCardSkeleton() {
  return (
    <Card variant="none" effect="glass" showRipple={false} className="p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
    </Card>
  );
}

// ============================================================================
// History Card
// ============================================================================

function HistoryCard({
  entry,
  onClick,
}: {
  entry: AnalysisHistoryEntry;
  onClick: () => void;
}) {
  const styles = decisionStyles(entry.decision);
  const confidencePercent = Math.round(
    entry.confidence >= 1 ? entry.confidence : entry.confidence * 100
  );

  return (
    <Card
      variant="none"
      effect="glass"
      showRipple
      interactive
      className="cursor-pointer group"
      onClick={onClick}
    >
      <CardContent className="space-y-3">
        {/* Top row: ticker + decision badge */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-black tracking-tight">{entry.ticker}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-muted-foreground">Confidence</span>
              <span className="text-xs font-bold">{confidencePercent}%</span>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider",
              styles.bg,
              styles.text,
              styles.border
            )}
          >
            {styles.icon}
            {entry.decision.toUpperCase()}
          </Badge>
        </div>

        {/* Summary */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {entry.final_statement || "Analysis complete — tap to view details."}
        </p>

        {/* Bottom row: timestamp + consensus */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo(entry.timestamp)}
          </span>
          {entry.consensus_reached && (
            <span className="text-emerald-500 font-medium">Consensus</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 space-y-6">
      <div className="p-4 rounded-full bg-primary/5 border border-primary/10">
        <BarChart3 className="w-8 h-8 text-primary/60" />
      </div>
      <div className="text-center space-y-2 max-w-sm">
        <h3 className="text-lg font-semibold">No analyses yet</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Search for a stock ticker below and let Agent Kai&apos;s multi-agent
          debate engine give you a data-driven recommendation.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AnalysisHistoryDashboard({
  userId,
  vaultKey,
  vaultOwnerToken,
  onSelectTicker: _onSelectTicker,
  onViewHistory,
}: AnalysisHistoryDashboardProps) {
  const [entries, setEntries] = useState<HistoryEntryWithVersion[]>([]);
  const [loading, setLoading] = useState(true);

  const [historyMap, setHistoryMap] = useState<AnalysisHistoryMap>({});
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versionsTicker, setVersionsTicker] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const nextMap = await KaiHistoryService.getAllHistory({
        userId,
        vaultKey,
        vaultOwnerToken,
      });
      setHistoryMap(nextMap);
      setEntries(processHistory(nextMap));
    } catch (err) {
      console.error("[AnalysisHistoryDashboard] Failed to load history:", err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [userId, vaultKey]);

  // ----- Delete Handlers -----

  const handleDeleteEntry = useCallback(async (entry: AnalysisHistoryEntry) => {
    const success = await KaiHistoryService.deleteEntry({
      userId,
      vaultKey,
      vaultOwnerToken,
      ticker: entry.ticker,
      timestamp: entry.timestamp,
    });

    if (success) {
      toast.success("Analysis deleted");
      fetchHistory();
    } else {
      toast.error("Failed to delete analysis");
    }
  }, [userId, vaultKey, vaultOwnerToken, fetchHistory]);

  const handleDeleteTicker = useCallback(async (ticker: string) => {
    const success = await KaiHistoryService.deleteTickerHistory({
      userId,
      vaultKey,
      vaultOwnerToken,
      ticker,
    });

    if (success) {
      toast.success(`All history for ${ticker} deleted`);
      fetchHistory();
    } else {
      toast.error(`Failed to delete history for ${ticker}`);
    }
  }, [userId, vaultKey, vaultOwnerToken, fetchHistory]);

  // ----- Columns -----
  const openVersions = useCallback((ticker: string) => {
    setVersionsTicker(ticker);
    setVersionsOpen(true);
  }, []);

  const columns = getColumns({
    onView: onViewHistory,
    onDelete: handleDeleteEntry,
    onDeleteTicker: handleDeleteTicker,
    onViewVersions: openVersions,
  });

  const versionsForTicker: HistoryEntryWithVersion[] = useMemo(() => {
    if (!versionsTicker) return [];
    const list = historyMap[versionsTicker] || [];

    // Oldest -> newest for version numbering
    const sortedAsc = [...list].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const withVersions = sortedAsc.map((entry, index) => ({
      ...entry,
      version: index + 1,
    }));

    // Show newest first in the modal
    return withVersions.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [historyMap, versionsTicker]);

  useEffect(() => {
    if (userId && vaultKey) {
      fetchHistory();
    } else {
      setLoading(false);
    }
  }, [userId, vaultKey, fetchHistory]);

  // ----- Loading state -----
  if (loading) {
    return (
      <div className="space-y-6 px-4 sm:px-6 pb-safe max-w-4xl mx-auto">
        {/* Search skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-[250px] rounded-md" />
        </div>
        {/* Card skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <HistoryCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // ----- Empty state -----
  if (entries.length === 0) {
    return <EmptyState />;
  }

  // ----- Populated state -----
  return (
    <div className="space-y-6 px-4 sm:px-6 pb-safe max-w-4xl mx-auto">
      {/* Header (search is global in Kai layout) */}
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Analysis History
        </h2>
        <Badge variant="secondary" className="text-[10px]">
          {entries.length}
        </Badge>
      </div>

      {/* Data Table */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <DataTable
          columns={columns}
          data={entries}
          searchKey="ticker"
          filterKey="decision"
          filterOptions={[
            { label: "Buy", value: "buy" },
            { label: "Hold", value: "hold" },
            { label: "Reduce", value: "reduce" },
          ]}
        />
      </div>

      {/* Versions Modal */}
      <Dialog
        open={versionsOpen}
        onOpenChange={(open) => {
          setVersionsOpen(open);
          if (!open) setVersionsTicker(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {versionsTicker ? `${versionsTicker} — Previous Versions` : "Previous Versions"}
            </DialogTitle>
          </DialogHeader>

          {versionsForTicker.length === 0 ? (
            <div className="text-sm text-muted-foreground">No previous versions found.</div>
          ) : (
            <div className="space-y-2">
              {versionsForTicker.map((entry) => {
                const styles = decisionStyles(entry.decision);
                const ts = entry.timestamp ? new Date(entry.timestamp) : null;

                return (
                  <Button
                    key={`${entry.ticker}-${entry.timestamp}`}
                    type="button"
                    variant="ghost"
                    className="w-full justify-between h-auto py-3 px-3"
                    onClick={() => {
                      onViewHistory(entry);
                      setVersionsOpen(false);
                      setVersionsTicker(null);
                    }}
                  >
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">v{entry.version}</span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            styles.bg,
                            styles.text,
                            styles.border
                          )}
                        >
                          {styles.icon}
                          {entry.decision}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {ts ? format(ts, "PPpp") : ""}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">Open</span>
                  </Button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AnalysisHistoryDashboard;
