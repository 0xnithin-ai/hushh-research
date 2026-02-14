"use client";

/**
 * Kai Layout - Minimal Mobile-First
 *
 * Wraps all /kai routes with VaultLockGuard.
 * ConsentSSEProvider and ConsentNotificationProvider are mounted at root (providers.tsx).
 */

import { VaultLockGuard } from "@/components/vault/vault-lock-guard";
import { KaiSearchBar } from "@/components/kai/kai-search-bar";
import { useRouter } from "next/navigation";
import { useKaiSession } from "@/lib/stores/kai-session-store";

export default function KaiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const setAnalysisParams = useKaiSession((s) => s.setAnalysisParams);

  return (
    <VaultLockGuard>
      <div className="flex flex-col min-h-screen">
        <main className="flex-1 pb-32">{children}</main>

        {/* Bottom-fixed search bar across all /kai routes */}
        <KaiSearchBar
          disabled={false}
          onCommand={(command, params) => {
            if (command === "analyze" && params?.symbol) {
              const symbol = String(params.symbol).toUpperCase();

              // Prime-assets-equivalent behavior:
              // - set Zustand analysis params
              // - navigate to analysis hub (no querystring)
              // IMPORTANT: userId must be the real Firebase user id, otherwise the backend
              // will 403 (token user mismatch) when streaming starts.
              //
              // We intentionally do NOT set a placeholder userId here; the analysis page
              // already has `useAuth()` and will normalize if needed.
              setAnalysisParams({
                ticker: symbol,
                userId: "",
                riskProfile: "balanced",
              });

              router.push("/kai/dashboard/analysis");
            }
          }}
        />
      </div>
    </VaultLockGuard>
  );
}
