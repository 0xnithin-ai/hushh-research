"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/lib/morphy-ux/card";
import { cn } from "@/lib/utils";
import type { KaiHomeRenaissanceItem } from "@/lib/services/api-service";

function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Price unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCompactNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatFcf(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "FCF N/A";
  return `$${value.toFixed(value >= 10 ? 0 : 1)}B FCF`;
}

function tierTone(tier: string | null | undefined): string {
  const normalized = String(tier || "").trim().toUpperCase();
  if (normalized === "ACE") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (normalized === "KING") return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
  if (normalized === "QUEEN") return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (normalized === "JACK") return "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300";
  return "bg-muted text-muted-foreground";
}

export function RenaissanceMarketList({
  rows = [],
}: {
  rows?: KaiHomeRenaissanceItem[];
}) {
  if (!rows.length) {
    return (
      <Card variant="muted" effect="fill" className="rounded-xl p-0">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Renaissance market names are not available right now.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1 px-1">
        <p className="text-sm font-black tracking-tight">Current Renaissance core list</p>
        <p className="text-xs text-muted-foreground">
          This is the app-wide default list Kai uses today until advisor-specific lists are wired.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => {
          const changePct = typeof row.change_pct === "number" && Number.isFinite(row.change_pct)
            ? row.change_pct
            : null;
          return (
            <Card key={`${row.symbol}-${row.tier || "tierless"}`} variant="none" effect="glass" className="rounded-xl p-0">
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black tracking-tight">{row.symbol}</p>
                    <p className="truncate text-sm text-muted-foreground">{row.company_name}</p>
                  </div>
                  <Badge variant="secondary" className={cn("border-0 font-bold", tierTone(row.tier))}>
                    {row.tier || "CORE"}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  {row.sector ? (
                    <span className="rounded-full bg-muted/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {row.sector}
                    </span>
                  ) : null}
                  {row.recommendation_bias ? (
                    <span className="rounded-full bg-background/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {row.recommendation_bias.replaceAll("_", " ")}
                    </span>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Price</p>
                    <p className="mt-1 text-base font-black tracking-tight">{formatCurrency(row.price)}</p>
                    <p
                      className={cn(
                        "text-xs font-semibold",
                        changePct === null && "text-muted-foreground",
                        changePct !== null && changePct >= 0 && "text-emerald-600 dark:text-emerald-400",
                        changePct !== null && changePct < 0 && "text-rose-600 dark:text-rose-400"
                      )}
                    >
                      {changePct === null ? "Change unavailable" : `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Market Cap</p>
                    <p className="mt-1 text-base font-black tracking-tight">{formatCompactNumber(row.market_cap)}</p>
                    <p className="text-xs text-muted-foreground">{formatFcf(row.fcf_billions)}</p>
                  </div>
                </div>

                <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                  {row.investment_thesis || "Renaissance thesis is unavailable for this name right now."}
                </p>

                <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
                  <span>Vol {formatCompactNumber(row.volume)}</span>
                  <span>{row.degraded ? "Delayed market data" : "Live market snapshot"}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
