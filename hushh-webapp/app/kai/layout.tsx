"use client";

/**
 * Kai Layout - Minimal Mobile-First
 *
 * Wraps all /kai routes with VaultLockGuard and onboarding guard.
 */

import { VaultLockGuard } from "@/components/vault/vault-lock-guard";
import { KaiOnboardingGuard } from "@/components/kai/onboarding/kai-onboarding-guard";
import { KaiNavTour } from "@/components/kai/onboarding/kai-nav-tour";
import { VaultMethodPrompt } from "@/components/vault/vault-method-prompt";
import { usePathname } from "next/navigation";

export default function KaiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const onOnboardingRoute = pathname.startsWith("/kai/onboarding");
  const onImportRoute = pathname.startsWith("/kai/import");
  const shouldEnableMethodPrompt = !onOnboardingRoute && !onImportRoute;

  return (
    <VaultLockGuard>
      <KaiOnboardingGuard>
        <div className="flex min-h-screen flex-col [--morphy-glass-accent-a:rgba(148,163,184,0.08)] [--morphy-glass-accent-b:rgba(226,232,240,0.08)] dark:[--morphy-glass-accent-a:rgba(63,63,70,0.16)] dark:[--morphy-glass-accent-b:rgba(82,82,91,0.14)]">
          <main className="flex-1 pb-32">{children}</main>
          <VaultMethodPrompt enabled={shouldEnableMethodPrompt} />
          <KaiNavTour />
        </div>
      </KaiOnboardingGuard>
    </VaultLockGuard>
  );
}
