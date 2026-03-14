"use client";

import { Badge } from "@/components/ui/badge";
import { SegmentedPill } from "@/lib/morphy-ux/ui/segmented-pill";
import type { PortfolioFreshness, PortfolioSource } from "@/lib/kai/brokerage/portfolio-sources";
import { Building2, Link2, RefreshCw, ScrollText } from "lucide-react";
import { Button } from "@/lib/morphy-ux/button";

interface PortfolioSourceSwitcherProps {
  activeSource: PortfolioSource;
  availableSources: PortfolioSource[];
  freshness?: PortfolioFreshness | null;
  onSourceChange: (source: PortfolioSource) => void;
  onRefreshPlaid?: () => void;
  onManageConnections?: () => void;
  isRefreshing?: boolean;
}

function formatRelativeTimestamp(value: string | null | undefined): string {
  if (!value) return "Not synced yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not synced yet";
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PortfolioSourceSwitcher({
  activeSource,
  availableSources,
  freshness,
  onSourceChange,
  onRefreshPlaid,
  onManageConnections,
  isRefreshing = false,
}: PortfolioSourceSwitcherProps) {
  const options = [
    {
      value: "statement",
      label: "Statement",
      icon: ScrollText,
      disabled: !availableSources.includes("statement"),
    },
    {
      value: "plaid",
      label: "Plaid",
      icon: Link2,
      disabled: !availableSources.includes("plaid"),
      tone: "accent" as const,
    },
  ];

  return (
    <div className="space-y-3 rounded-[24px] border border-border/60 bg-background/80 p-4 shadow-sm backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Portfolio Source
          </p>
          <SegmentedPill
            value={activeSource}
            options={options}
            onValueChange={(value) => onSourceChange(value as PortfolioSource)}
            ariaLabel="Portfolio source selector"
            size="compact"
            className="w-full max-w-md"
          />
        </div>
        {availableSources.includes("plaid") ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              {freshness?.itemCount || 0} item{(freshness?.itemCount || 0) === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline">
              Synced {formatRelativeTimestamp(freshness?.lastSyncedAt || null)}
            </Badge>
            {onRefreshPlaid ? (
              <Button
                variant="none"
                effect="fade"
                size="sm"
                onClick={onRefreshPlaid}
                disabled={isRefreshing}
              >
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            ) : null}
            {onManageConnections ? (
              <Button variant="none" effect="fade" size="sm" onClick={onManageConnections}>
                Manage Connections
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

    </div>
  );
}
