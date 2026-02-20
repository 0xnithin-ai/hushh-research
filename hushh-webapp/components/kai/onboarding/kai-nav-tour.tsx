"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Compass, UserRound, Shield, Mic2 } from "lucide-react";
import { usePathname } from "next/navigation";

import { Card, CardContent } from "@/lib/morphy-ux/card";
import { Button } from "@/lib/morphy-ux/button";
import { Icon } from "@/lib/morphy-ux/ui";
import { useAuth } from "@/hooks/use-auth";
import { useVault } from "@/lib/vault/vault-context";
import { KaiNavTourLocalService } from "@/lib/services/kai-nav-tour-local-service";
import { KaiProfileService } from "@/lib/services/kai-profile-service";
import { getKaiChromeState } from "@/lib/navigation/kai-chrome-state";

const TOUR_STEPS = [
  {
    id: "nav-kai",
    title: "Kai",
    description: "Your market intelligence home and navigation anchor.",
    icon: Compass,
  },
  {
    id: "nav-consents",
    title: "Consents",
    description: "Review and control every active data consent.",
    icon: Shield,
  },
  {
    id: "nav-profile",
    title: "Profile",
    description: "Manage vault security, identity, and personal settings.",
    icon: UserRound,
  },
  {
    id: "nav-agent-nav",
    title: "Agent Nav",
    description: "Access agent shortcuts and voice-first workflows.",
    icon: Mic2,
  },
] as const;

function isResolved(state: {
  completed_at: string | null;
  skipped_at: string | null;
} | null): boolean {
  return Boolean(state?.completed_at || state?.skipped_at);
}

export function KaiNavTour() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { isVaultUnlocked, vaultKey, vaultOwnerToken } = useVault();

  const [stepIndex, setStepIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const chromeState = useMemo(() => getKaiChromeState(pathname), [pathname]);
  const normalizedPath = pathname?.replace(/\/+$/, "") || "";
  const isEligibleRoute =
    normalizedPath === "/kai" || normalizedPath === "/kai/dashboard";
  const activeStep = TOUR_STEPS[stepIndex] ?? TOUR_STEPS[0];

  useEffect(() => {
    let cancelled = false;

    async function evaluate() {
      if (loading || !user?.uid || !isEligibleRoute || chromeState.useOnboardingChrome) {
        if (!cancelled) setOpen(false);
        return;
      }

      const local = await KaiNavTourLocalService.load(user.uid);
      if (cancelled) return;

      const localResolved = isResolved(local);
      const localSynced = Boolean(local?.synced_to_vault_at);
      const localResolvedForGate = localResolved;

      if (isVaultUnlocked && vaultKey && vaultOwnerToken) {
        try {
          const profile = await KaiProfileService.getProfile({
            userId: user.uid,
            vaultKey,
            vaultOwnerToken,
          });

          if (cancelled) return;

          if (profile.onboarding.nav_tour_completed_at) {
            await KaiNavTourLocalService.markCompleted(user.uid);
            await KaiNavTourLocalService.markSynced(user.uid);
            setOpen(false);
            return;
          }

          if (profile.onboarding.nav_tour_skipped_at) {
            await KaiNavTourLocalService.markSkipped(user.uid);
            await KaiNavTourLocalService.markSynced(user.uid);
            setOpen(false);
            return;
          }

          // If local state says resolved but never synced, and vault profile has
          // no completion markers, treat local as stale and show tour again.
          if (localResolved && !localSynced) {
            setStepIndex(0);
            setOpen(true);
            return;
          }
        } catch (error) {
          console.warn("[KaiNavTour] Failed to read vault-backed tour state:", error);
        }
      }

      if (localResolvedForGate) {
        setOpen(false);
        return;
      }

      setStepIndex(0);
      setOpen(true);
    }

    void evaluate();

    return () => {
      cancelled = true;
    };
  }, [
    chromeState.useOnboardingChrome,
    isEligibleRoute,
    isVaultUnlocked,
    loading,
    user?.uid,
    vaultKey,
    vaultOwnerToken,
  ]);

  // Highlight active nav item while the tour is open.
  useEffect(() => {
    const all = Array.from(document.querySelectorAll<HTMLElement>("[data-tour-id]"));
    all.forEach((el) => {
      el.classList.remove("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background", "shadow-lg", "z-50");
    });

    if (!open || !activeStep) {
      return;
    }

    const target = document.querySelector<HTMLElement>(`[data-tour-id=\"${activeStep.id}\"]`);
    target?.classList.add(
      "ring-2",
      "ring-primary",
      "ring-offset-2",
      "ring-offset-background",
      "shadow-lg",
      "z-50"
    );

    return () => {
      target?.classList.remove(
        "ring-2",
        "ring-primary",
        "ring-offset-2",
        "ring-offset-background",
        "shadow-lg",
        "z-50"
      );
    };
  }, [activeStep, open]);

  const progress = useMemo(
    () => Math.round(((stepIndex + 1) / TOUR_STEPS.length) * 100),
    [stepIndex]
  );

  async function syncToVaultIfAvailable(payload: {
    completedAt?: string | null;
    skippedAt?: string | null;
  }) {
    if (!user?.uid || !isVaultUnlocked || !vaultKey) return;
    try {
      await KaiProfileService.setNavTourState({
        userId: user.uid,
        vaultKey,
        vaultOwnerToken: vaultOwnerToken ?? undefined,
        completedAt: payload.completedAt,
        skippedAt: payload.skippedAt,
      });
      await KaiNavTourLocalService.markSynced(user.uid);
    } catch (error) {
      console.warn("[KaiNavTour] Failed to sync nav tour state:", error);
    }
  }

  async function handleSkip() {
    if (!user?.uid) return;
    const local = await KaiNavTourLocalService.markSkipped(user.uid);
    await syncToVaultIfAvailable({
      completedAt: null,
      skippedAt: local.skipped_at,
    });
    setOpen(false);
  }

  async function handleDone() {
    if (!user?.uid) return;
    const local = await KaiNavTourLocalService.markCompleted(user.uid);
    await syncToVaultIfAvailable({
      completedAt: local.completed_at,
      skippedAt: null,
    });
    setOpen(false);
  }

  if (!open || !activeStep) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  return (
    <div className="pointer-events-none fixed inset-0 z-[140]">
      <div className="pointer-events-auto absolute inset-0 bg-black/35 dark:bg-black/45" />
      <div className="pointer-events-auto absolute inset-x-3 bottom-[calc(var(--app-bottom-inset)+16px)] sm:left-1/2 sm:right-auto sm:w-[min(30rem,calc(100vw-1.5rem))] sm:-translate-x-1/2">
        <Card
          variant="none"
          effect="glass"
          className="rounded-2xl p-0 shadow-2xl border-border/80 !bg-popover/96 dark:!bg-popover/94 text-popover-foreground backdrop-blur-xl"
        >
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex min-w-0 items-center gap-2">
                <Icon icon={activeStep.icon} size="sm" className="text-[var(--brand-600)]" />
                <p className="truncate text-sm font-semibold">Bottom Navigation Tour</p>
              </div>
              <p className="ml-2 shrink-0 text-xs text-muted-foreground tabular-nums">
                {stepIndex + 1}/{TOUR_STEPS.length} · {progress}%
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black">{activeStep.title}</h3>
              <p className="text-sm text-muted-foreground">{activeStep.description}</p>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <Button
                variant="blue-gradient"
                effect="fade"
                size="default"
                className="w-full"
                onClick={() => void handleSkip()}
              >
                Skip
              </Button>

              <Button
                variant="blue-gradient"
                effect="fade"
                size="default"
                className="w-full"
                disabled={isFirst}
                onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Button>

              <Button
                size="default"
                className="w-full"
                onClick={() => {
                  if (isLast) {
                    void handleDone();
                    return;
                  }
                  setStepIndex((prev) => Math.min(TOUR_STEPS.length - 1, prev + 1));
                }}
              >
                {isLast ? "Done" : "Next"}
                {!isLast && <ArrowRight className="ml-1 h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
