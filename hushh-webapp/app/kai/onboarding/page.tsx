"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { morphyToast as toast } from "@/lib/morphy-ux/morphy";

import { HushhLoader } from "@/components/app-ui/hushh-loader";
import { KaiPersonaScreen } from "@/components/kai/onboarding/KaiPersonaScreen";
import { KaiPreferencesWizard } from "@/components/kai/onboarding/KaiPreferencesWizard";
import {
  KaiProfileService,
  computeRiskScore,
  mapRiskProfile,
  type KaiProfileV2,
  type RiskProfile,
  type DrawdownResponse,
  type InvestmentHorizon,
  type VolatilityPreference,
} from "@/lib/services/kai-profile-service";
import {
  PreVaultOnboardingService,
  type PreVaultOnboardingAnswers,
  type PreVaultOnboardingState,
} from "@/lib/services/pre-vault-onboarding-service";
import { VaultService } from "@/lib/services/vault-service";
import { useAuth } from "@/hooks/use-auth";
import { useVault } from "@/lib/vault/vault-context";
import {
  setOnboardingFlowActiveCookie,
  setOnboardingRequiredCookie,
} from "@/lib/services/onboarding-route-cookie";

type Stage = "loading" | "wizard" | "persona";
type OnboardingSource = "pre_vault" | "vault";

type WizardAnswers = {
  investment_horizon: InvestmentHorizon | null;
  drawdown_response: DrawdownResponse | null;
  volatility_preference: VolatilityPreference | null;
};

function profileToAnswers(profile: KaiProfileV2 | null): WizardAnswers {
  return {
    investment_horizon: profile?.preferences.investment_horizon ?? null,
    drawdown_response: profile?.preferences.drawdown_response ?? null,
    volatility_preference: profile?.preferences.volatility_preference ?? null,
  };
}

function pendingToAnswers(pending: PreVaultOnboardingState | null): WizardAnswers {
  return {
    investment_horizon: pending?.answers.investment_horizon ?? null,
    drawdown_response: pending?.answers.drawdown_response ?? null,
    volatility_preference: pending?.answers.volatility_preference ?? null,
  };
}

function computePersona(answers: WizardAnswers, explicit?: RiskProfile | null): RiskProfile {
  if (explicit) return explicit;
  const score = computeRiskScore(answers as PreVaultOnboardingAnswers);
  return score === null ? "balanced" : mapRiskProfile(score);
}

export default function KaiOnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { vaultKey, vaultOwnerToken, isVaultUnlocked } = useVault();

  const [source, setSource] = useState<OnboardingSource | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<KaiProfileV2 | null>(null);
  const [preVaultState, setPreVaultState] = useState<PreVaultOnboardingState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (authLoading) return;

      if (!user) {
        router.replace("/login?redirect=%2Fkai%2Fonboarding");
        return;
      }

      try {
        setStage("loading");

        const hasVault = await VaultService.checkVault(user.uid);
        if (cancelled) return;

        if (!hasVault) {
          setSource("pre_vault");
          const pending = await PreVaultOnboardingService.load(user.uid);
          if (cancelled) return;

          if (pending?.completed) {
            setOnboardingRequiredCookie(false);
            setOnboardingFlowActiveCookie(false);
            router.replace("/kai");
            return;
          }

          setOnboardingRequiredCookie(true);
          setOnboardingFlowActiveCookie(false);

          setPreVaultState(pending);
          // Always start from the questionnaire flow on reload until onboarding is completed.
          // We keep draft answers, but do not auto-jump to persona.
          setStage("wizard");
          return;
        }

        setSource("vault");

        if (!isVaultUnlocked || !vaultKey || !vaultOwnerToken) {
          setStage("loading");
          return;
        }

        const nextProfile = await KaiProfileService.getProfile({
          userId: user.uid,
          vaultKey,
          vaultOwnerToken,
        });

        if (cancelled) return;

        setProfile(nextProfile);
        if (nextProfile.onboarding.completed) {
          setOnboardingRequiredCookie(false);
          setOnboardingFlowActiveCookie(false);
          router.replace("/kai");
          return;
        }

        setOnboardingRequiredCookie(true);
        setOnboardingFlowActiveCookie(false);
        // Always return to the questionnaire until the onboarding completion flag is set.
        setStage("wizard");
      } catch (error) {
        console.warn("[KaiOnboardingPage] Failed to load onboarding:", error);
        if (!cancelled) {
          setSource("pre_vault");
          setStage("wizard");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.uid, isVaultUnlocked, vaultKey, vaultOwnerToken, router]);

  const wizardAnswers: WizardAnswers = useMemo(() => {
    if (source === "vault") return profileToAnswers(profile);
    return pendingToAnswers(preVaultState);
  }, [source, profile, preVaultState]);

  const persona: RiskProfile = useMemo(() => {
    if (source === "vault") {
      return computePersona(wizardAnswers, profile?.preferences.risk_profile ?? null);
    }
    return computePersona(wizardAnswers, preVaultState?.risk_profile ?? null);
  }, [source, wizardAnswers, profile?.preferences.risk_profile, preVaultState?.risk_profile]);

  if (authLoading || stage === "loading" || !source) {
    return <HushhLoader label="Loading onboarding..." variant="fullscreen" />;
  }

  if (!user) {
    return <HushhLoader label="Redirecting..." variant="fullscreen" />;
  }

  if (stage === "persona") {
    return (
      <KaiPersonaScreen
        riskProfile={persona}
        onEditAnswers={() => setStage("wizard")}
        onLaunchDashboard={async () => {
          if (saving) return;

          try {
            setSaving(true);
            const riskScore = computeRiskScore(wizardAnswers as PreVaultOnboardingAnswers);

            if (source === "vault") {
              if (!vaultKey || !vaultOwnerToken) {
                toast.error("Unlock your vault to continue.");
                return;
              }
              const nextProfile = await KaiProfileService.setOnboardingCompleted({
                userId: user.uid,
                vaultKey,
                vaultOwnerToken,
                skippedPreferences: false,
              });
              setProfile(nextProfile);
            } else {
              await PreVaultOnboardingService.markCompleted(user.uid, {
                skipped: false,
                answers: wizardAnswers,
                risk_score: riskScore,
                risk_profile: persona,
              });
            }

            toast.success("Preferences saved. Next step: connect your portfolio or Plaid.");
            setOnboardingRequiredCookie(false);
            setOnboardingFlowActiveCookie(true);
            router.replace("/kai/import");
          } catch (error) {
            console.error("[KaiOnboardingPage] Failed to finalize onboarding:", error);
            toast.error("Couldn't complete onboarding. Please retry.");
          } finally {
            setSaving(false);
          }
        }}
      />
    );
  }

  return (
    <KaiPreferencesWizard
      mode="onboarding"
      layout="page"
      initialStep={0}
      initialAnswers={wizardAnswers}
      onBack={() => router.replace("/kai")}
      onAnswersChange={(nextAnswers) => {
        if (source !== "pre_vault") return;
        const score = computeRiskScore(nextAnswers as PreVaultOnboardingAnswers);
        void PreVaultOnboardingService.saveDraft(user.uid, {
          answers: nextAnswers,
          risk_score: score,
          risk_profile: score === null ? null : mapRiskProfile(score),
        }).then((nextState) => {
          setPreVaultState(nextState);
        });
      }}
      onSkip={async () => {
        if (saving) return;

        try {
          setSaving(true);
          if (source === "vault") {
            if (!vaultKey || !vaultOwnerToken) {
              toast.error("Unlock your vault to continue.");
              return;
            }
            const nextProfile = await KaiProfileService.setOnboardingCompleted({
              userId: user.uid,
              vaultKey,
              vaultOwnerToken,
              skippedPreferences: true,
            });
            setProfile(nextProfile);
          } else {
            const nextState = await PreVaultOnboardingService.markCompleted(user.uid, {
              skipped: true,
              answers: wizardAnswers,
              risk_score: preVaultState?.risk_score ?? null,
              risk_profile: preVaultState?.risk_profile ?? null,
            });
            setPreVaultState(nextState);
          }

          toast.info("Preferences skipped. You can edit them later.");
          setOnboardingRequiredCookie(false);
          setOnboardingFlowActiveCookie(false);
          router.replace("/kai");
        } catch (error) {
          console.error("[KaiOnboardingPage] Skip failed:", error);
          toast.error("Couldn't skip onboarding. Please retry.");
        } finally {
          setSaving(false);
        }
      }}
      onComplete={async (payload) => {
        if (saving) return;
        const nextAnswers: WizardAnswers = {
          investment_horizon: payload.investment_horizon,
          drawdown_response: payload.drawdown_response,
          volatility_preference: payload.volatility_preference,
        };

        try {
          setSaving(true);

          if (source === "vault") {
            if (!vaultKey || !vaultOwnerToken) {
              toast.error("Unlock your vault to continue.");
              return;
            }

            const nextProfile = await KaiProfileService.savePreferences({
              userId: user.uid,
              vaultKey,
              vaultOwnerToken,
              updates: nextAnswers,
              mode: "onboarding",
            });
            setProfile(nextProfile);
          } else {
            const score = computeRiskScore(nextAnswers as PreVaultOnboardingAnswers);
            const nextState = await PreVaultOnboardingService.saveDraft(user.uid, {
              answers: nextAnswers,
              risk_score: score,
              risk_profile: score === null ? null : mapRiskProfile(score),
            });
            setPreVaultState(nextState);
          }

          setStage("persona");
        } catch (error) {
          console.error("[KaiOnboardingPage] Failed to save preferences:", error);
          toast.error("Couldn't save preferences. Please retry.");
        } finally {
          setSaving(false);
        }
      }}
    />
  );
}
