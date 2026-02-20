/**
 * ImportProgressView Component
 *
 * Real-time streaming progress UI for portfolio import.
 * Displays extraction progress with a single canonical stage timeline.
 *
 * Features:
 * - Factual progress display (indeterminate until measurable counters exist)
 * - Single stage timeline transcript for stream events
 * - Parsed holdings preview while extraction/parsing progresses
 * - Cancel button
 * - Completion summary with review action
 */

"use client";

import { useMemo } from "react";
import { cn } from "@/lib/morphy-ux";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/lib/morphy-ux/card";
import { Progress } from "@/components/ui/progress";
import { Button as MorphyButton } from "@/lib/morphy-ux/button";
import { X, FileChartColumn, CheckCircle2 } from "lucide-react";
import { Icon } from "@/lib/morphy-ux/ui";
import { useSmoothStreamProgress } from "@/lib/morphy-ux/hooks/use-smooth-stream-progress";


export type ImportStage =
  | "idle"
  | "uploading"
  | "indexing"
  | "scanning"
  | "thinking"
  | "extracting"
  | "parsing"
  | "complete"
  | "error";

interface LiveHoldingPreview {
  symbol?: string;
  name?: string;
  market_value?: number | null;
  quantity?: number | null;
  asset_type?: string;
}

export interface ImportProgressViewProps {
  /** Current processing stage */
  stage: ImportStage;
  /** Whether actively streaming */
  isStreaming: boolean;
  /** Stream progress percentage from backend canonical payload */
  progressPct?: number;
  /** Optional status message from backend payload */
  statusMessage?: string;
  /** Ordered stage/status trail captured during stream */
  stageTrail?: string[];
  /** Incremental parsed holdings preview */
  liveHoldings?: LiveHoldingPreview[];
  /** Parsed holdings count so far */
  holdingsExtracted?: number;
  /** Total holdings expected */
  holdingsTotal?: number;
  /** Error message if stage is 'error' */
  errorMessage?: string;
  /** Cancel handler */
  onCancel?: () => void;
  /** Continue from completed import to review screen */
  onContinue?: () => void;
  /** Return to dashboard after completed import */
  onBackToDashboard?: () => void;
  /** Additional CSS classes */
  className?: string;
}

const stageMessages: Record<ImportStage, string> = {
  idle: "Ready to import",
  uploading: "Processing uploaded file...",
  indexing: "Indexing document...",
  scanning: "Scanning pages and sections...",
  thinking: "AI reasoning about your portfolio...",
  extracting: "Extracting financial data...",
  parsing: "Processing extracted data...",
  complete: "Import complete!",
  error: "Import failed",
};

function normalizeStageLine(rawLine: string): string {
  const line = rawLine.trim().replace(/\s+/g, " ");
  if (!line) return "";
  const match = line.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!match) {
    return line;
  }
  const rawTag = match[1] ?? "";
  const rawMessage = match[2] ?? "";
  const tag = rawTag.trim().toUpperCase();
  const message = rawMessage.trim();
  return message ? `[${tag}] ${message}` : `[${tag}]`;
}

function stageLineKey(line: string): string {
  const match = line.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!match) {
    return line.trim().toLowerCase();
  }
  const rawTag = match[1] ?? "";
  const rawMessage = match[2] ?? "";
  return `[${rawTag.trim().toUpperCase()}] ${rawMessage.trim().toLowerCase()}`;
}

export function ImportProgressView({
  stage,
  isStreaming,
  progressPct,
  statusMessage,
  stageTrail = [],
  liveHoldings = [],
  holdingsExtracted = 0,
  holdingsTotal,
  errorMessage,
  onCancel,
  onContinue,
  onBackToDashboard,
  className,
}: ImportProgressViewProps) {
  const isComplete = stage === "complete";
  const hasMeasuredProgress = useMemo(
    () => typeof progressPct === "number" && Number.isFinite(progressPct) && progressPct > 0,
    [progressPct]
  );
  const resolvedProgress = useMemo(() => {
    if (hasMeasuredProgress) {
      return Math.max(0, Math.min(100, progressPct as number));
    }
    if (stage === "complete" || stage === "error") {
      return 100;
    }
    return 0;
  }, [hasMeasuredProgress, progressPct, stage]);
  const smoothProgress = useSmoothStreamProgress(resolvedProgress);

  const stageLines = useMemo(() => {
    const rawLines = stageTrail.length > 0 ? stageTrail : [statusMessage || stageMessages[stage]];
    const formatted: string[] = [];
    let lastKey = "";
    for (const rawLine of rawLines) {
      const normalizedLine = normalizeStageLine(rawLine);
      if (!normalizedLine) continue;
      const key = stageLineKey(normalizedLine);
      if (key === lastKey) continue;
      formatted.push(normalizedLine);
      lastKey = key;
    }
    return formatted;
  }, [stageTrail, stage, statusMessage]);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon icon={FileChartColumn} size="md" className={cn(isStreaming && "text-primary")} />
            <CardTitle className="text-lg">Importing Portfolio</CardTitle>
          </div>
          {onCancel && stage !== "complete" && (
            <MorphyButton
              variant="muted"
              size="sm"
              onClick={onCancel}
              className="h-8 rounded-lg"
              icon={{ icon: X }}
            >
              Back to Dashboard
            </MorphyButton>
          )}

        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stream Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Import progress</span>
            <span>
              {hasMeasuredProgress || stage === "complete" || stage === "error"
                ? `${Math.round(smoothProgress)}%`
                : "Tracking stages"}
            </span>
          </div>
          {hasMeasuredProgress || stage === "complete" || stage === "error" ? (
            <Progress
              value={smoothProgress}
              className={cn("h-2", isStreaming && "transition-all")}
            />
          ) : (
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-1/3 rounded-full bg-primary/70 animate-pulse" />
            </div>
          )}
        </div>

        {/* Status Message */}
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {statusMessage || stageMessages[stage]}
          </p>
        </div>


        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>AI Stream Transcript</span>
            <span>
              {isStreaming ? "Live" : isComplete ? "Complete" : "Idle"}
            </span>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            <div className="rounded-lg border border-border/40 bg-background/70 px-3 py-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Stage timeline
              </p>
              <div className="space-y-1">
                {stageLines.map((line, index) => (
                  <p key={`${line}-${index}`} className="text-xs leading-relaxed">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Parsed holdings preview while parsing */}
        {(holdingsExtracted > 0 || liveHoldings.length > 0) && (
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Extracted Holdings</span>
              <span>
                {holdingsExtracted}
                {typeof holdingsTotal === "number" && holdingsTotal > 0 ? ` / ${holdingsTotal}` : ""}
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto pr-1 space-y-1.5">
              {liveHoldings.map((holding, idx) => (
                  <div
                    key={`${holding.symbol || holding.name || "holding"}-${idx}`}
                    className="rounded-lg border border-border/40 bg-background/70 px-2.5 py-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground/90 truncate">
                          {holding.symbol || `Holding ${idx + 1}`}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {holding.name || "Security captured from statement"}
                        </p>
                      </div>
                      {holding.asset_type && (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border/50 rounded px-1.5 py-0.5">
                          {holding.asset_type}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        Qty:{" "}
                        {typeof holding.quantity === "number"
                          ? holding.quantity.toLocaleString()
                          : "—"}
                      </span>
                      <span>
                        Value:{" "}
                        {typeof holding.market_value === "number"
                          ? `$${holding.market_value.toLocaleString()}`
                          : "—"}
                      </span>
                    </div>
                  </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {stage === "error" && errorMessage && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-sm text-red-500">{errorMessage}</p>
          </div>
        )}

        {/* Complete State */}
        {stage === "complete" && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <div className="flex items-center gap-2">
              <Icon icon={CheckCircle2} size="md" className="text-emerald-500" />
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              Successfully extracted portfolio data
            </p>
          </div>
            {holdingsExtracted > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Final holdings extracted: {holdingsExtracted}
                {typeof holdingsTotal === "number" && holdingsTotal > 0 ? ` / ${holdingsTotal}` : ""}
              </p>
            )}
            {onContinue && (
              <MorphyButton
                variant="gradient"
                size="sm"
                className="mt-3"
                onClick={onContinue}
              >
                Review Extracted Portfolio
              </MorphyButton>
            )}
            {onBackToDashboard && (
              <MorphyButton
                variant="muted"
                size="sm"
                className="mt-2 ml-2"
                onClick={onBackToDashboard}
              >
                Back to Dashboard
              </MorphyButton>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
