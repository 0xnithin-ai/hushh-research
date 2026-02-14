"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/morphy-ux/card";
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Shield,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Scale,
  FileText,
  Link2,
  Crown,
  Sparkles, // Use Sparkles for QUEEN if Crown is for KING
  Trophy,
  Medal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Label,
  LabelList, // Added LabelList
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useTheme } from "next-themes";

// ============================================================================
// Types
// ============================================================================

export interface DecisionResult {
  ticker: string;
  decision: "buy" | "hold" | "reduce" | string;
  confidence: number;
  consensus_reached: boolean;
  final_statement: string;
  agent_votes?: Record<string, string>;
  dissenting_opinions?: string[];
  // Enriched data
  fundamental_summary?: string;
  sentiment_summary?: string;
  valuation_summary?: string;
  raw_card?: {
    fundamental_insight?: {
      summary?: string;
      business_moat?: string;
      financial_resilience?: string;
      growth_efficiency?: string;
      bull_case?: string;
      bear_case?: string;
    };
    quant_metrics?: Record<string, any>;
    key_metrics?: {
      fundamental?: Record<string, any>;
      sentiment?: {
        sentiment_score?: number;
        catalyst_count?: number;
      };
      valuation?: Record<string, any>;
    };
    all_sources?: string[];
    risk_persona_alignment?: string;
    debate_digest?: string;
    consensus_reached?: boolean;
    dissenting_opinions?: string[];
    // Renaissance Data (New)
    renaissance_tier?: "ACE" | "KING" | "QUEEN" | "JACK";
    renaissance_score?: number;
  };
}

// ============================================================================
// Source URL Helpers
// ============================================================================

const KNOWN_SOURCE_URLS: Record<string, string> = {
  "yahoo finance": "https://finance.yahoo.com",
  "sec edgar": "https://www.sec.gov/cgi-bin/browse-edgar",
  "google finance": "https://www.google.com/finance",
  "bloomberg": "https://www.bloomberg.com",
  "reuters": "https://www.reuters.com",
  "finnhub": "https://finnhub.io",
  "marketwatch": "https://www.marketwatch.com",
  "seeking alpha": "https://seekingalpha.com",
};

function parseSourceUrl(source: string): { text: string; url: string | null } {
  const urlMatch = source.match(/https?:\/\/[^\s)]+/);
  if (urlMatch) {
    return { text: source.replace(urlMatch[0], "").trim() || urlMatch[0], url: urlMatch[0] };
  }
  const lower = source.toLowerCase();
  for (const [key, url] of Object.entries(KNOWN_SOURCE_URLS)) {
    if (lower.includes(key)) {
      return { text: source, url };
    }
  }
  return { text: source, url: null };
}

function SourceLink({ source }: { source: string }) {
  const { text, url } = parseSourceUrl(source);
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] text-primary/80 hover:text-primary truncate pl-2 border-l-2 border-primary/20 flex items-center gap-1 transition-colors"
      >
        <Link2 className="w-2.5 h-2.5 shrink-0" />
        <span className="truncate">{text || url}</span>
      </a>
    );
  }
  return (
    <p className="text-[10px] text-muted-foreground truncate pl-2 border-l-2 border-primary/20">
      {text}
    </p>
  );
}

// ============================================================================
// Chart Sub-Components
// ============================================================================

const radarChartConfig = {
  value: {
    label: "Confidence",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

function AgentConfidenceRadar({ result }: { result: DecisionResult }) {
  const keyMetrics = result.raw_card?.key_metrics;
  if (!keyMetrics) return null;

  const data = [
    {
      agent: "Fundamental",
      value: (keyMetrics.fundamental?.confidence as number) || result.confidence || 0,
    },
    {
      agent: "Sentiment",
      value: keyMetrics.sentiment?.sentiment_score !== undefined
        ? ((keyMetrics.sentiment.sentiment_score + 1) / 2)
        : result.confidence || 0,
    },
    {
      agent: "Valuation",
      value: (keyMetrics.valuation?.confidence as number) || result.confidence || 0,
    },
  ].map((d) => ({ ...d, value: Math.round(d.value * 100) }));

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
        Agent Confidence
      </p>
      <ChartContainer config={radarChartConfig} className="h-[180px] w-full">
        <RadarChart accessibilityLayer data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <PolarAngleAxis dataKey="agent" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Radar
            dataKey="value"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ChartContainer>
    </div>
  );
}

const consensusChartConfig = {
  agree: {
    label: "Agree",
    color: "hsl(var(--emerald-500))", // Morphy Token
  },
  dissent: {
    label: "Dissent",
    color: "hsl(var(--amber-500))", // Morphy Token
  },
} satisfies ChartConfig;

function ConsensusDonut({ result }: { result: DecisionResult }) {
  const votes = result.agent_votes ? Object.values(result.agent_votes) : [];
  if (votes.length === 0) return null;

  const majority = result.decision.toLowerCase();
  const agreeCount = votes.filter((v) => String(v).toLowerCase() === majority).length;
  const dissentCount = votes.length - agreeCount;

  const data = [
    { name: "Agree", value: agreeCount, fill: consensusChartConfig.agree.color },
    { name: "Dissent", value: dissentCount, fill: consensusChartConfig.dissent.color },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
        Consensus
      </p>
      <ChartContainer config={consensusChartConfig} className="h-[120px] w-full">
        <PieChart accessibilityLayer>
          <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
          <Pie data={data} cx="50%" cy="50%" innerRadius={30} outerRadius={48} dataKey="value" strokeWidth={0}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="flex justify-center gap-3">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: d.name === "Agree" ? consensusChartConfig.agree.color : consensusChartConfig.dissent.color }}
            />
            {d.name} ({d.value})
          </div>
        ))}
      </div>
    </div>
  );
}

const barChartConfig = {
  value: {
    label: "Value",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

function QuantMetricsBarChart({ metrics }: { metrics: Record<string, any> }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const data = useMemo(() => {
    return Object.entries(metrics)
      .filter(([, v]) => typeof v === "number" && v !== 0 && !Number.isNaN(v))
      .slice(0, 6)
      .map(([key, value]) => ({
        name: key.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
        value: Math.abs(value as number) >= 1e9
          ? (value as number) / 1e9
          : Math.abs(value as number) >= 1e6
          ? (value as number) / 1e6
          : (value as number),
        isNegative: (value as number) < 0,
      }));
  }, [metrics]);

  if (data.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <BarChart3 className="w-3.5 h-3.5" />
        Valuation & Fundamentals
      </p>
      <ChartContainer config={barChartConfig} className="w-full h-[160px]">
        <BarChart accessibilityLayer data={data} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis 
            type="category" 
            dataKey="name" 
            width={110} 
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} 
            axisLine={false} 
            tickLine={false} 
          />
          <ChartTooltip cursor={{ fill: isDark ? "#ffffff10" : "#00000005" }} content={<ChartTooltipContent hideLabel />} />
          <Bar 
            dataKey="value" 
            fill="hsl(var(--primary))" 
            radius={[0, 4, 4, 0]} 
            barSize={12}
            background={{ fill: isDark ? "#ffffff05" : "#00000005" }}
          >
            <LabelList dataKey="value" position="right" fontSize={9} fill="hsl(var(--foreground))" formatter={(val: number) => val.toFixed(1)} />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}

// NEW: Confidence Gauge (Semi-circle Pie)
function ConfidenceGauge({ confidence }: { confidence: number }) {
  const score = Math.round(confidence * 100);
  
  const data = [
    { name: "Score", value: score, fill: "hsl(var(--primary))" },
    { name: "Max", value: 100 - score, fill: "hsl(var(--muted))" },
  ];

  return (
    <div className="relative flex flex-col items-center justify-center h-[100px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="100%"
            startAngle={180}
            endAngle={0}
            innerRadius={60}
            outerRadius={80}
            paddingAngle={0}
            dataKey="value"
            stroke="none"
          >
            <Cell key="score" fill="hsl(var(--primary))" />
            <Cell key="remainder" fill="hsl(var(--muted))" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute bottom-0 text-center pb-2">
        <div className="text-3xl font-black tracking-tighter tabular-nums leading-none">
          {score}%
        </div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          Confidence
        </div>
      </div>
    </div>
  );
}

// NEW: Renaissance Badge
function RenaissanceBadge({ tier, score }: { tier: "ACE" | "KING" | "QUEEN" | "JACK"; score?: number }) {
  const badgeConfig = {
    ACE: {
      color: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/30 dark:text-fuchsia-400 dark:border-fuchsia-800",
      icon: <Crown className="w-3.5 h-3.5 fill-current" />,
      label: "Renaissance Ace",
    },
    KING: {
      color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
      icon: <Trophy className="w-3.5 h-3.5 fill-current" />,
      label: "Renaissance King",
    },
    QUEEN: {
      color: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800",
      icon: <Sparkles className="w-3.5 h-3.5 fill-current" />,
      label: "Renaissance Queen",
    },
    JACK: {
      color: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
      icon: <Medal className="w-3.5 h-3.5 fill-current" />,
      label: "Renaissance Jack",
    },
  };

  const config = badgeConfig[tier];

  return (
    <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold uppercase tracking-wider shadow-sm", config.color)}>
      {config.icon}
      {config.label}
      {score && <span className="ml-1 opacity-70">| {score.toFixed(0)}</span>}
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function AgentSummarySection({
  title,
  summary,
  icon,
  color,
}: {
  title: string;
  summary: string;
  icon: React.ReactNode;
  color: string;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  if (!summary) return null;

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden bg-card/30 backdrop-blur-sm transition-all duration-200 hover:bg-card/50 hover:border-border/80 hover:shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left flex items-center gap-3 p-3 transition-colors duration-200 cursor-pointer">
        <div className={cn("flex items-center justify-center w-6 h-6 rounded-full bg-background border shadow-sm", color)}>
            {icon}
        </div>
        <span className={cn("text-xs font-bold uppercase tracking-wide", color)}>{title}</span>
        <div className="ml-auto opacity-50">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 text-xs text-muted-foreground leading-relaxed animate-in slide-in-from-top-1 fade-in duration-200">
          {summary}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DecisionCard({ result }: { result: DecisionResult }) {
  const [showSources, setShowSources] = useState(false);
  const isBuy = result.decision.toLowerCase() === "buy";
  const isReduce = result.decision.toLowerCase() === "reduce" || result.decision.toLowerCase() === "sell";

  const rawCard = result.raw_card;
  const sources = rawCard?.all_sources || [];
  const hasAgentSummaries = result.fundamental_summary || result.sentiment_summary || result.valuation_summary;
  const hasQuantMetrics = rawCard?.quant_metrics && Object.keys(rawCard.quant_metrics).filter(
    (k) => rawCard.quant_metrics![k] !== null && rawCard.quant_metrics![k] !== undefined && typeof rawCard.quant_metrics![k] !== "object"
  ).length > 0;

  // Fallback for empty/missing decision to prevent layout shift
  const safeDecision = result.decision || "HOLD";
  const safeConfidence = result.confidence || 0;

  return (
    <Card
      variant="none"
      effect="glass"
      showRipple={false}
      className="border-primary/20 bg-primary/5 animate-in fade-in zoom-in duration-500 rounded-3xl overflow-hidden"
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <CardTitle className="text-sm font-black uppercase tracking-widest">Final Recommendation</CardTitle>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
          >
            COMPLETE
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        
        {/* HERO SECTION: Decision + Badges */}
        <div className="flex flex-col items-center gap-4">
            
            {/* Renaissance Badge - Positioned prominently if exists */}
            {rawCard?.renaissance_tier && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-700 delay-100">
                    <RenaissanceBadge tier={rawCard.renaissance_tier} score={rawCard.renaissance_score} />
                </div>
            )}

            {/* Main Decision Pill */}
            <div
                className={cn(
                "px-10 py-5 rounded-2xl border-2 text-4xl font-black uppercase tracking-tighter shadow-xl backdrop-blur-md transform transition-all duration-300 hover:scale-[1.02]",
                isBuy
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-emerald-500/10"
                    : isReduce
                    ? "bg-red-500/10 border-red-500/20 text-red-500 shadow-red-500/10"
                    : "bg-blue-500/10 border-blue-500/20 text-blue-500 shadow-blue-500/10"
                )}
            >
                {safeDecision}
            </div>

            {/* Confidence Gauge - Replacing Linear Progress */}
            <ConfidenceGauge confidence={safeConfidence} />
        </div>

        <Separator className="bg-primary/10" />

        {/* DATA VISUALIZATION GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AgentConfidenceRadar result={result} />
          {hasQuantMetrics && rawCard?.quant_metrics ? (
               <QuantMetricsBarChart metrics={rawCard.quant_metrics} />
          ) : (
               <ConsensusDonut result={result} />
          )}
        </div>

        {/* KEY INSIGHTS SECTION */}
        <div className="space-y-3">
            {/* Risk Persona Alignment */}
            {rawCard?.risk_persona_alignment && (
            <div className="p-4 bg-background/50 border border-primary/10 rounded-2xl backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wide">Risk Alignment</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{rawCard.risk_persona_alignment}</p>
            </div>
            )}

            {/* Key Takeaway - Highlight the most important insight */}
            {rawCard?.fundamental_insight?.summary && (
            <div className="p-5 bg-linear-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Zap className="w-24 h-24 rotate-12" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="text-xs font-black uppercase tracking-widest text-primary">Key Takeaway</span>
                    </div>
                    <p className="text-sm font-semibold leading-relaxed text-foreground/90">{rawCard.fundamental_insight.summary}</p>
                </div>
            </div>
            )}
        </div>

        {/* SECONDARY METRICS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Business Moat */}
            {rawCard?.fundamental_insight?.business_moat && (
            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                <Shield className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Moat</span>
                </div>
                <p className="text-xs text-muted-foreground">{rawCard.fundamental_insight.business_moat}</p>
            </div>
            )}
            
            {/* Sentiment Gauge Card */}
            {rawCard?.key_metrics?.sentiment?.sentiment_score !== undefined && (
            <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-2xl flex flex-col justify-center">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-3.5 h-3.5 text-purple-500" />
                        <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">Sentiment</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono bg-purple-500/10 text-purple-500 border-purple-500/20">
                        {(rawCard.key_metrics.sentiment.sentiment_score * 100).toFixed(0)}%
                    </Badge>
                </div>
                <Progress value={(rawCard.key_metrics.sentiment.sentiment_score + 1) * 50} className="h-1.5 mb-2" />
                <p className="text-[10px] text-muted-foreground text-center font-medium">
                {rawCard.key_metrics.sentiment.sentiment_score > 0.3 ? "Bullish" : rawCard.key_metrics.sentiment.sentiment_score < -0.3 ? "Bearish" : "Neutral"}
                </p>
            </div>
            )}
        </div>

        {/* BULL / BEAR TOGGLES */}
        {(rawCard?.fundamental_insight?.bull_case || rawCard?.fundamental_insight?.bear_case) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rawCard.fundamental_insight.bull_case && (
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Bull Case</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{rawCard.fundamental_insight.bull_case}</p>
                </div>
            )}
            {rawCard.fundamental_insight.bear_case && (
                <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Bear Case</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{rawCard.fundamental_insight.bear_case}</p>
                </div>
            )}
            </div>
        )}

        {/* FINANCIAL RESILIENCE & GROWTH */}
        {(rawCard?.fundamental_insight?.financial_resilience || rawCard?.fundamental_insight?.growth_efficiency) && (
          <div className="grid grid-cols-2 gap-3">
            {rawCard.fundamental_insight.financial_resilience && (
              <div className="p-3 bg-card/40 rounded-xl border border-border/40">
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1 font-bold">Resilience</p>
                <p className="text-xs font-medium">{rawCard.fundamental_insight.financial_resilience}</p>
              </div>
            )}
            {rawCard.fundamental_insight.growth_efficiency && (
              <div className="p-3 bg-card/40 rounded-xl border border-border/40">
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1 font-bold">Growth Eff.</p>
                <p className="text-xs font-medium">{rawCard.fundamental_insight.growth_efficiency}</p>
              </div>
            )}
          </div>
        )}

        {/* FINAL STATEMENT */}
        <div className="p-5 bg-card/60 rounded-2xl border border-border/60">
            <div className="flex items-center gap-2 mb-2 opacity-50">
                <FileText className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Verdict Rationale</span>
            </div>
            <p className="text-sm font-medium leading-relaxed">{rawCard?.debate_digest || result.final_statement}</p>
        </div>

        {/* AGENT DETAILED SUMMARIES - Collapsible (REMOVED: Redundant with Debate Tabs) */}
        {/* User feedback: "We are already showing round 1 and 2 above, the decision card need not again have the Deep analysis section" */}
        {/* {hasAgentSummaries && (
          <div className="space-y-3 pt-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 pl-1">
              <Sparkles className="w-3.5 h-3.5" />
              Deep Analysis
            </p>
            <div className="space-y-2">
              {result.fundamental_summary && (
                <AgentSummarySection
                  title="Fundamental Analysis"
                  summary={result.fundamental_summary}
                  icon={<TrendingUp className="w-3.5 h-3.5 text-blue-500" />}
                  color="text-blue-500"
                />
              )}
              {result.sentiment_summary && (
                <AgentSummarySection
                  title="Sentiment Analysis"
                  summary={result.sentiment_summary}
                  icon={<BarChart3 className="w-3.5 h-3.5 text-purple-500" />}
                  color="text-purple-500"
                />
              )}
              {result.valuation_summary && (
                <AgentSummarySection
                  title="Valuation Analysis"
                  summary={result.valuation_summary}
                  icon={<TrendingDown className="w-3.5 h-3.5 text-emerald-500" />}
                  color="text-emerald-500"
                />
              )}
            </div>
          </div>
        )} */}
        
        {/* Consensus Donut - Only show here if QuantMetrics took the main spot */}
        {hasQuantMetrics && rawCard?.quant_metrics && (
             <div className="pt-2">
                <Separator className="bg-primary/5 mb-4" />
                <ConsensusDonut result={result} />
             </div>
        )}

        {/* DISSENT */}
        {result.dissenting_opinions && result.dissenting_opinions.length > 0 && (
          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" />
              Dissenting Opinions
            </p>
            <ul className="space-y-2">
              {result.dissenting_opinions.map((opinion, idx) => (
                <li key={idx} className="text-xs text-muted-foreground pl-3 border-l-2 border-amber-500/30">
                  {opinion}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* SOURCES */}
        {sources.length > 0 && (
          <>
            <Separator className="opacity-30" />
            <div>
              <button
                onClick={() => setShowSources(!showSources)}
                className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors duration-200"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Sources ({sources.length})
                {showSources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showSources && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sources.map((src, i) => (
                    <SourceLink key={i} source={src} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* DISCLAIMER */}
        <div className="pt-4">
          <p className="text-[10px] text-muted-foreground/50 text-center leading-relaxed max-w-xs mx-auto">
            Agent Kai is an educational tool and does not constitute investment advice. Always consult a qualified
            financial advisor.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
