import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const pathnameRef = { current: "/kai" };

vi.mock("next/navigation", () => ({
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
    isVaultUnlocked: true,
    vaultKey: "vault-key",
    vaultOwnerToken: "vault-owner-token",
  }),
}));

const loadMock = vi.fn();
const markCompletedMock = vi.fn();
const markSkippedMock = vi.fn();
const markSyncedMock = vi.fn();

vi.mock("@/lib/services/kai-nav-tour-local-service", () => ({
  KaiNavTourLocalService: {
    load: (...args: unknown[]) => loadMock(...args),
    markCompleted: (...args: unknown[]) => markCompletedMock(...args),
    markSkipped: (...args: unknown[]) => markSkippedMock(...args),
    markSynced: (...args: unknown[]) => markSyncedMock(...args),
  },
}));

const getProfileMock = vi.fn();

vi.mock("@/lib/services/kai-profile-service", () => ({
  KaiProfileService: {
    getProfile: (...args: unknown[]) => getProfileMock(...args),
    setNavTourState: vi.fn(),
  },
}));

import { KaiNavTour } from "@/components/kai/onboarding/kai-nav-tour";

describe("KaiNavTour", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathnameRef.current = "/kai";
    document.cookie = "kai_onboarding_flow_active=0; path=/";
    loadMock.mockResolvedValue(null);
    getProfileMock.mockResolvedValue({
      onboarding: {
        nav_tour_completed_at: null,
        nav_tour_skipped_at: null,
      },
    });
    markSyncedMock.mockResolvedValue(null);
    markCompletedMock.mockResolvedValue(null);
    markSkippedMock.mockResolvedValue(null);
  });

  it("shows tour on eligible route when unresolved", async () => {
    render(<KaiNavTour />);

    await waitFor(() => {
      expect(screen.getByText("Bottom Navigation Tour")).toBeTruthy();
    });
  });
});
