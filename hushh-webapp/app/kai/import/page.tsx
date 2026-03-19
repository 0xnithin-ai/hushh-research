"use client";

import { useEffect, useState } from "react";

import { AppPageContentRegion, AppPageShell } from "@/components/app-ui/app-page-shell";
import { KaiFlow } from "@/components/kai/kai-flow";
import { useAuth } from "@/lib/firebase/auth-context";
import { useVault } from "@/lib/vault/vault-context";
import { useStepProgress } from "@/lib/progress/step-progress-context";

export default function KaiImportPage() {
  const { user, loading: authLoading } = useAuth();
  const { vaultOwnerToken } = useVault();
  const [initialized, setInitialized] = useState(false);
  const { registerSteps, completeStep, reset } = useStepProgress();

  useEffect(() => {
    if (authLoading) return;

    if (!initialized) {
      registerSteps(1);
      setInitialized(true);
    }

    if (user) {
      completeStep();
    }

    return () => reset();
  }, [authLoading, completeStep, initialized, registerSteps, reset, user]);

  if (authLoading || !user) {
    return null;
  }

  return (
    <AppPageShell
      as="div"
      width="wide"
      className="relative pb-32"
    >
      <AppPageContentRegion>
        <KaiFlow
          userId={user.uid}
          mode="import"
          vaultOwnerToken={vaultOwnerToken ?? ""}
        />
      </AppPageContentRegion>
    </AppPageShell>
  );
}
