import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const routerReplaceMock = vi.fn();
const pathnameRef = { current: "/kai" };

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplaceMock,
  }),
  usePathname: () => pathnameRef.current,
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { uid: "user-1" },
    loading: false,
  }),
}));

vi.mock("@/lib/vault/vault-context", () => ({
  useVault: () => ({
    isVaultUnlocked: false,
    vaultKey: null,
    vaultOwnerToken: null,
  }),
}));

vi.mock("@/lib/services/vault-service", () => ({
  VaultService: {
    checkVault: vi.fn(),
  },
}));

vi.mock("@/lib/services/kai-profile-service", () => ({
  KaiProfileService: {
    getProfile: vi.fn(),
  },
}));

vi.mock("@/lib/services/kai-profile-sync-service", () => ({
  KaiProfileSyncService: {
    syncPendingToVault: vi.fn(),
  },
}));

vi.mock("@/lib/services/pre-vault-onboarding-service", () => ({
  PreVaultOnboardingService: {
    load: vi.fn(),
  },
}));

import { KaiOnboardingGuard } from "@/components/kai/onboarding/kai-onboarding-guard";

describe("KaiOnboardingGuard import-first redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "kai_onboarding_flow_active=1; path=/";
    pathnameRef.current = "/kai";
  });

  it("redirects /kai to /kai/import when onboarding flow is active", async () => {
    render(
      <KaiOnboardingGuard>
        <div>child</div>
      </KaiOnboardingGuard>
    );

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith("/kai/import");
    });
  });
});
