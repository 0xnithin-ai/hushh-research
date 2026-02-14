"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertCircle, RefreshCw, X, WifiOff, ShieldAlert, Clock, CheckCircle2 } from "lucide-react";
import { setKaiVaultOwnerToken } from "@/lib/services/kai-service";
import { KaiHistoryService } from "@/lib/services/kai-history-service";
import { CacheService, CACHE_KEYS } from "@/lib/services/cache-service";
import { DecisionCard } from "./views/decision-card";
import { RoundTabsCard } from "./views/round-tabs-card";
import { TrinityCards } from "./views/trinity-cards";
import { toast } from "sonner";
import { Card, CardContent } from "@/lib/morphy-ux/card";
import { HushhLoader } from "@/components/ui/hushh-loader";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ApiService } from "@/lib/services/api-service";

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

function getErrorDisplay(errorType: ErrorType, retryIn?: number): { icon: React.ReactNode; title: string; message: string } {
  switch (errorType) {
    case "rate_limit":
      return {
        icon: <Clock className="w-8 h-8 text-amber-500" />,
        title: "Rate Limit Reached",
        message: retryIn ? `Too many requests. Retrying in ${retryIn}s...` : "Too many requests. Please try again in a moment.",
      };
    case "auth_expired":
      return {
        icon: <ShieldAlert className="w-8 h-8 text-red-500" />,
        title: "Session Expired",
        message: "Your session has expired. Please re-authenticate to continue.",
      };
    case "server_error":
      return {
        icon: <AlertCircle className="w-8 h-8 text-red-500" />,
        title: "Server Error",
        message: retryIn ? `Server encountered an error. Retrying in ${retryIn}s...` : "Server error. Please try again.",
      };
    case "connection_lost":
      return {
        icon: <WifiOff className="w-8 h-8 text-orange-500" />,
        title: "Connection Lost",
        message: "Lost connection to the analysis server.",
      };
    default:
      return {
        icon: <AlertCircle className="w-8 h-8 text-red-500" />,
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
}

export function DebateStreamView({ ticker, userId, riskProfile: riskProfileProp, vaultOwnerToken, vaultKey, onClose }: DebateStreamViewProps) {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<ErrorType>("unknown");
  const [kaiThinking, setKaiThinking] = useState<string>("Initializing...");
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);

  // Rounds
  const [activeRound, setActiveRound] = useState<1 | 2>(1);
  const [round1States, setRound1States] = useState<Record<string, AgentState>>(
    JSON.parse(JSON.stringify(INITIAL_ROUND_STATE))
  );
  const [round2States, setRound2States] = useState<Record<string, AgentState>>(
    JSON.parse(JSON.stringify(INITIAL_ROUND_STATE))
  );

  // Live Insights State
  const [insights, setInsights] = useState<Insight[]>([]);
  const insightsRef = useRef<Insight[]>([]); // Ref for stream safety

  // Refs for robust state tracking inside async stream
  const round1StatesRef = useRef<Record<string, AgentState>>(JSON.parse(JSON.stringify(INITIAL_ROUND_STATE)));
  const round2StatesRef = useRef<Record<string, AgentState>>(JSON.parse(JSON.stringify(INITIAL_ROUND_STATE)));

  // UI Control
  const [activeAgent, setActiveAgent] = useState("fundamental");
  const [collapsedRounds, setCollapsedRounds] = useState<Record<number, boolean>>({ 1: false, 2: true });

  const [decision, setDecision] = useState<any>(null);

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
  // Trinity State
  const [trinityState, setTrinityState] = useState<{
    bull?: string;
    bear?: string;
    renaissance?: string;
  }>({});

  const containerRef = useRef<HTMLDivElement>(null);

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
    onClose();
  }, [onClose]);

  // Reset state for retry
  const resetState = useCallback(() => {
    setLoading(true);
    setError(null);
    setErrorType("unknown");
    setKaiThinking("Initializing...");
    setActiveRound(1);
    setRound1States(JSON.parse(JSON.stringify(INITIAL_ROUND_STATE)));
    setRound2States(JSON.parse(JSON.stringify(INITIAL_ROUND_STATE)));
    setActiveAgent("fundamental");
    setCollapsedRounds({ 1: false, 2: true });
    setActiveAgent("fundamental");
    setCollapsedRounds({ 1: false, 2: true });
    setDecision(null);
    setInsights([]);
    setRetryCountdown(null);
    setTrinityState({}); // Reset Trinity state
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
        abortControllerRef.current = new AbortController();

        // Fetch and decrypt user context (Portfolio, Bio, etc.)
        let context = null;
        if (vaultKey) {
          try {
             // 1. Get encrypted profile
             const { getEncryptedProfile } = await import("@/lib/services/kai-service");
             const { profileData } = await getEncryptedProfile(vaultOwnerToken);

             if (profileData) {
               // 2. Decrypt
               const { decryptData } = await import("@/lib/vault/encrypt");
               const decryptedJson = await decryptData(
                 {
                   ciphertext: profileData.ciphertext,
                   iv: profileData.iv,
                   tag: profileData.tag,
                   encoding: "base64",
                   algorithm: "aes-256-gcm",
                 },
                 vaultKey
               );
               context = JSON.parse(decryptedJson);
               // Add user name if available in the profile
               if (context && !context.name && context.identity?.name) {
                 context.name = context.identity.name;
               }
             }
          } catch (err) {
            console.warn("[DebateStreamView] Failed to load/decrypt context:", err);
            // Non-fatal, proceed without context
          }
        }

        const riskProfile = riskProfileProp || "balanced";

        // Start SSE connection via ApiService.
        // This centralizes Android localhost→10.0.2.2 normalization and
        // uses native plugins on iOS/Android when available.
        const response = await ApiService.streamKaiAnalysis({
          userId,
          ticker,
          riskProfile,
          userContext: context, // Pass the FULL decrypted context object
          vaultOwnerToken,
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

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No stream content");

        const decoder = new TextDecoder();
        let buffer = "";
        let currentEventType = "message";
        let currentPhase = "analysis";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (line.startsWith("event:")) {
              currentEventType = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              try {
                const jsonStr = line.slice(5).trim();
                if (!jsonStr) continue;

                const data = JSON.parse(jsonStr);

                switch (currentEventType) {
                  case "kai_thinking":
                    setKaiThinking(data.message || data.data?.message);

                    // Detect Phase Change for Round Switching
                    if (data.phase === "debate" && currentPhase !== "debate") {
                      currentPhase = "debate";
                      setActiveRound(2);
                      setCollapsedRounds({ 1: true, 2: false });
                      toast.info("Entering Round 2: Debate & Rebuttal");
                    }
                    break;

                  case "agent_start":
                    setActiveAgent(data.agent);
                    {
                      const targetRound: 1 | 2 = currentPhase === "debate" || data.phase === "round2" ? 2 : 1;
                      updateAgentState(targetRound, data.agent, { stage: "active" });
                    }
                    break;

                  case "agent_token":
                    {
                      // Backend streams tokens as: { agent: "fundamental"|..., text: "...", phase?: "analysis"|"debate"|"round2" }
                      // Some emitters may use agent_name; normalize.
                      const ag = (data.agent || data.agent_name || "").toString().toLowerCase();
                      const txt = (data.text || data.token || "").toString();
                      if (!ag || !txt) break;

                      const r: 1 | 2 = currentPhase === "debate" || data.phase === "round2" ? 2 : 1;

                      // Update Ref
                      const ref = r === 1 ? round1StatesRef : round2StatesRef;
                      const runRef = ref.current;
                      if (runRef?.[ag]) {
                        runRef[ag] = {
                          ...runRef[ag],
                          stage: runRef[ag].stage === "idle" ? "active" : runRef[ag].stage,
                          text: (runRef[ag].text || "") + txt,
                        };
                      }

                      // Update React State
                      const setter = r === 1 ? setRound1States : setRound2States;
                      setter((prev) => ({
                        ...prev,
                        [ag]: {
                          ...prev[ag],
                          stage: prev[ag]?.stage === "idle" ? "active" : prev[ag]?.stage,
                          text: (prev[ag]?.text || "") + txt,
                        },
                      }));
                    }
                    break;

                  case "agent_complete":
                    {
                      const r: 1 | 2 = currentPhase === "debate" ? 2 : 1;
                      updateAgentState(r, data.agent, {
                        stage: "complete",
                        text: data.summary || "",
                        thoughts: [],
                        // Common fields
                        recommendation: data.recommendation,
                        confidence: data.confidence,
                        sources: data.sources,
                        // Fundamental-specific
                        keyMetrics: data.key_metrics,
                        quantMetrics: data.quant_metrics,
                        businessMoat: data.business_moat,
                        financialResilience: data.financial_resilience,
                        growthEfficiency: data.growth_efficiency,
                        bullCase: data.bull_case,
                        bearCase: data.bear_case,
                        // Sentiment-specific
                        sentimentScore: data.sentiment_score,
                        keyCatalysts: data.key_catalysts,
                        // Valuation-specific
                        valuationMetrics: data.valuation_metrics,
                        peerComparison: data.peer_comparison,
                        priceTargets: data.price_targets,
                      });
                    }
                    break;

                  case "debate_round":
                    // Round metadata -- handled structurally by phase switching
                    break;

                  case "agent_error":
                    {
                      const r: 1 | 2 = currentPhase === "debate" ? 2 : 1;
                      const errMsg = data.error || "Agent analysis failed";
                      updateAgentState(r, data.agent, {
                        stage: "error",
                        error: errMsg,
                      });
                      toast.error(`${data.agent} encountered an error`, {
                        description: errMsg.length > 100 ? errMsg.slice(0, 100) + "..." : errMsg,
                      });
                    }
                    break;

                  case "insight_extracted":
                    {
                      const newInsight: Insight = {
                        ...data,
                        timestamp: new Date().toISOString(),
                      };
                      
                      // Dedup based on ID and content hash if needed, but backend sends unique events
                      // We use Ref for immediate updates if we had other logic, but setState is fine here
                      // Handle Trinity Events
                      if (data.type === "bull_case_personalized") {
                        setTrinityState(prev => ({ ...prev, bull: data.content }));
                      }
                      if (data.type === "bear_case_personalized") {
                        setTrinityState(prev => ({ ...prev, bear: data.content }));
                      }
                      if (data.type === "renaissance_verdict") {
                        setTrinityState(prev => ({ ...prev, renaissance: data.content }));
                      }

                      setInsights(prev => [...prev, newInsight]);
                      insightsRef.current.push(newInsight);
                      
                      // Toast for high impact items
                      if (data.type === "impact" && (data.magnitude === "high" || data.score >= 8)) {
                         toast(data.classification === "risk" ? "⚠️ Portfolio Risk Detected" : "🚀 Portfolio Opportunity", {
                           description: data.content,
                           action: { label: "View", onClick: () => {} }
                         });
                      }
                    }
                    break;

                  case "decision":
                    setDecision(data);
                    setKaiThinking("Analysis Complete.");
                    // Auto-collapse Round 2 when decision arrives
                    setCollapsedRounds({ 1: true, 2: true });
                    // Save to analysis history (fire-and-forget)
                    if (vaultKey && userId) {
                      KaiHistoryService.saveAnalysis({
                        userId,
                        vaultKey,
                        vaultOwnerToken,
                        entry: {
                          ticker: ticker.toUpperCase(),
                          timestamp: new Date().toISOString(),
                          decision: data.decision || "hold",
                          confidence: data.confidence || 0,
                          consensus_reached: data.consensus_reached ?? false,
                          agent_votes: data.agent_votes || {},
                          final_statement: data.final_statement || "",
                          raw_card: data.raw_card || {},
                          debate_transcript: {
                             round1: round1StatesRef.current,
                             round2: round2StatesRef.current,
                          },
                        },
                      }).then(() => {
                        // Invalidate caches after decision is persisted
                        const cache = CacheService.getInstance();
                        cache.invalidate(CACHE_KEYS.STOCK_CONTEXT(userId, ticker.toUpperCase()));
                        cache.invalidate(CACHE_KEYS.DOMAIN_DATA(userId, "kai_analysis_history"));
                      }).catch((e) => console.warn("[DebateStreamView] History save failed:", e));
                    }
                    break;

                  case "error":
                    {
                      const errMsg = data.message || "Analysis failed";
                      const errType = classifyError(null, errMsg);

                      // Attempt retry for server-side errors
                      if ((errType === "rate_limit" || errType === "server_error") && retryCountRef.current < MAX_RETRIES) {
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
                    }
                    break;
                }
              } catch (e) {
                // Gracefully skip malformed JSON events
                console.warn("[DebateStreamView] JSON Parse Error on line:", line, e);
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log("Stream aborted by user");
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
      } finally {
        setLoading(false);
      }
    },
    [ticker, userId, vaultOwnerToken, riskProfileProp, updateAgentState, resetState]
  );

  // Effect to start stream on mount
  useEffect(() => {
    startStream();

    // Production-grade disconnect: abort on force-close, mobile swipe-away
    const abortStream = () => abortControllerRef.current?.abort();
    window.addEventListener('beforeunload', abortStream);

    let visibilityTimeout: NodeJS.Timeout | undefined;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Mobile: abort after 5s in background (catches swipe-away)
        visibilityTimeout = setTimeout(abortStream, 5000);
      } else {
        clearTimeout(visibilityTimeout);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
      window.removeEventListener('beforeunload', abortStream);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearTimeout(visibilityTimeout);
    };
  }, [startStream]);

  // -------------- RENDER ----------------

  // Error state with classified display
  if (error) {
    const display = getErrorDisplay(errorType, retryCountdown ?? undefined);
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 space-y-4">
        <Card variant="none" effect="glass" showRipple={false} className="max-w-md w-full">
          <CardContent className="p-8 flex flex-col items-center space-y-4">
            <div className="p-4 rounded-full bg-muted/30">{display.icon}</div>
            <h3 className="text-lg font-semibold text-center">{display.title}</h3>
            <p className="text-sm text-muted-foreground text-center">{error}</p>
            {retryCountdown !== null && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Retrying in {retryCountdown}s...</span>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {errorType !== "auth_expired" && (
                <Button
                  onClick={() => {
                    retryCountRef.current = 0;
                    resetState();
                    hasStartedRef.current = false;
                    startStream();
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Retry
                </Button>
              )}
              {errorType === "auth_expired" && (
                <Button onClick={onClose}>
                  <ShieldAlert className="w-4 h-4 mr-2" /> Re-authenticate
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-transparent relative">
      {/* Header - Masked gradient + hero ticker */}
      <div className="flex-none sticky top-0 z-10 overflow-hidden">
        {/* Masked gradient background */}
        <div
          className="absolute inset-0 morphy-app-bg opacity-80"
          style={{ maskImage: "linear-gradient(to bottom, black 60%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent)" }}
        />
        <div className="absolute inset-0 backdrop-blur-md bg-background/40" />

        {/* Content */}
        <div className="relative px-4 pt-3 pb-2">


          {/* Hero row: Centered ticker with close button on right */}
          <div className="grid grid-cols-[40px_1fr_40px] items-center">
            {/* Left spacer */}
            <div />
            {/* Center: Ticker + status */}
            <div className="flex flex-col items-center gap-1">
              <h1 className="text-3xl font-black tracking-tighter text-foreground">{ticker}</h1>
              {/* Status badge */}
              {decision ? (
                <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
                </Badge>
              ) : loading ? (
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 font-medium">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" /> {kaiThinking}
                </Badge>
              ) : retryCountdown !== null ? (
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                  Retry in {retryCountdown}s
                </Badge>
              ) : null}
            </div>
            {/* Right: History button */}
            <div className="flex justify-end">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClose} 
                className="shrink-0 h-8 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <span>History</span>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Overall Progress Bar */}
          {!decision && loading && (
            <div className="mt-3">
              <Progress value={overallProgress} className="h-1.5 rounded-full" />
              <p className="text-[10px] text-muted-foreground mt-1 text-center">
                {progressLabel}
              </p>
            </div>
          )}
          {decision && (
            <div className="mt-3">
              <Progress value={100} className="h-1.5 rounded-full" />
            </div>
          )}
        </div>
      </div>

      {/* Loading State for Initial Connect */}
      {loading && !decision && activeRound === 1 && round1States.fundamental?.stage === "idle" && (
        <div className="p-8 flex justify-center">
          <HushhLoader variant="inline" label="Connecting to agents..." />
        </div>
      )}

      {/* Content - Scrollable */}
      {/* Content - Scrollable split view */}
      <ScrollArea className="flex-1 p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto px-4 sm:px-6 pb-10">
          
          {/* Main Debate Column (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Round 1 */}
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

          {/* Round 2 - Only show if started */}
          {(activeRound >= 2 || decision) && (
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
          )}

          {/* TRINITY CARDS - The New Scientist-Level Layer */}
          <div className="mb-6">
            <TrinityCards 
              bullCase={trinityState.bull}
              bearCase={trinityState.bear}
              renaissanceVerdict={trinityState.renaissance}
            />
          </div>

          {/* Decision Card (Final Result) */}
          {decision && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <DecisionCard result={decision} />
            </div>
          )}

          {/* Spacer for bottom */}
          <div className="h-10" />
          </div>
          
          {/* Live Intel Panel (1/3 width) - Sticky on desktop, Hidden on mobile */}
          <div className="hidden lg:block lg:col-span-1">
             <div className="sticky top-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live Intel Graph
                  </h3>
                  <Badge variant="outline" className="text-[10px] h-5">
                    {insights.length} Nodes
                  </Badge>
                </div>
                
                {insights.length === 0 ? (
                  <Card variant="none" className="p-6 border-dashed">
                    <div className="text-center text-xs text-muted-foreground">
                      <div className="mb-2">Scanning stream for insights...</div>
                      <Loader2 className="w-4 h-4 animate-spin mx-auto opacity-50" />
                    </div>
                  </Card>
                ) : (
                  <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-1 custom-scrollbar">
                    {insights.map((insight, i) => (
                      <div key={i} className="group animate-in slide-in-from-right-2 duration-500 fade-in">
                        <Card variant="muted" className={`p-3 text-xs border-l-2 ${
                           insight.type === 'impact' ? (insight.classification === 'risk' ? 'border-l-red-500 bg-red-500/5' : 'border-l-green-500 bg-green-500/5') :
                           insight.type === 'claim' ? 'border-l-blue-500' :  
                           'border-l-zinc-500'
                        }`}>
                           <div className="flex items-center gap-2 mb-1">
                             <Badge variant="secondary" className="text-[9px] h-4 px-1 rounded-sm uppercase tracking-wider">
                               {insight.type.replace('_', ' ')}
                             </Badge>
                             <span className="text-[10px] text-muted-foreground uppercase">{insight.agent}</span>
                           </div>
                           <p className="leading-relaxed">{insight.content}</p>
                           
                           {insight.type === 'impact' && (
                             <div className="mt-2 flex items-center gap-2">
                               <Progress value={(insight.score || 0) * 10} className={`h-1 w-16 ${insight.classification === 'risk' ? 'bg-red-100 [&>div]:bg-red-500' : 'bg-green-100 [&>div]:bg-green-500'}`} />
                               <span className="text-[9px] font-mono">{insight.score}/10 Impact</span>
                             </div>
                           )}
                           
                           {insight.type === 'evidence' && (
                             <div className="mt-1 text-[9px] text-muted-foreground/80 flex items-center gap-1">
                               <ShieldAlert className="w-3 h-3" />
                               Source: {insight.source}
                             </div>
                           )}
                        </Card>
                      </div>
                     ))}
                     {/* Auto-scroll disabled for mobile/passive reading */}
                     <div ref={(el) => {
                        if (el && window.innerWidth >= 1024) { // Only auto-scroll on desktop
                           el.scrollIntoView({ behavior: "smooth" });
                        }
                     }} />
                  </div>
                )}
             </div>
          </div>

        </div>
      </ScrollArea>
    </div>
  );
}
