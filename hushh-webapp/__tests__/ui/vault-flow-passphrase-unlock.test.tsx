import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const unlockVaultMock = vi.fn();

vi.mock("@/lib/vault/vault-context", () => ({
  useVault: () => ({
    unlockVault: unlockVaultMock,
  }),
}));

vi.mock("@/lib/services/vault-service", () => ({
  VaultService: {
    checkVault: vi.fn(),
    getVaultState: vi.fn(),
    getPrimaryWrapper: vi.fn(
      (state: { wrappers?: Array<{ method?: string }> } | undefined) =>
        state?.wrappers?.[0] ?? null
    ),
    getWrapperByMethod: vi.fn(
      (
        state: { wrappers?: Array<{ method?: string }> } | undefined,
        method: string
      ) => state?.wrappers?.find((wrapper) => wrapper?.method === method) ?? null
    ),
    unlockWithMethod: vi.fn(),
    getOrIssueVaultOwnerToken: vi.fn(),
    setVaultCheckCache: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

import { VaultService } from "@/lib/services/vault-service";
import { VaultFlow } from "@/components/vault/vault-flow";

describe("VaultFlow passphrase unlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the latest passphrase value when unlocking", async () => {
    (VaultService.checkVault as any).mockResolvedValue(true);
    (VaultService.getVaultState as any).mockResolvedValue({
      vaultKeyHash: "abc123",
      primaryMethod: "passphrase",
      recoveryEncryptedVaultKey: "r1",
      recoverySalt: "r2",
      recoveryIv: "r3",
      wrappers: [{ method: "passphrase", encryptedVaultKey: "e", salt: "s", iv: "i" }],
    });
    (VaultService.unlockWithMethod as any).mockResolvedValue(
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    );
    (VaultService.getOrIssueVaultOwnerToken as any).mockResolvedValue({
      token: "token",
      expiresAt: Date.now() + 60_000,
    });

    render(
      <VaultFlow user={{ uid: "uid-1", displayName: "User" } as any} onSuccess={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText(/unlock your vault/i)).toBeTruthy();
    });

    const passphrase = "CorrectHorseBatteryStaple";
    fireEvent.change(screen.getByLabelText(/passphrase/i), {
      target: { value: passphrase },
    });
    fireEvent.click(screen.getByRole("button", { name: /unlock with passphrase/i }));

    await waitFor(() => {
      expect(VaultService.unlockWithMethod).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "passphrase",
          secretMaterial: passphrase,
        })
      );
    });
  });
});
