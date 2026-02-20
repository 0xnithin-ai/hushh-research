"use client";

import { normalizeStoredPortfolio } from "@/lib/utils/portfolio-normalize";
import { KaiProfileSyncService } from "@/lib/services/kai-profile-sync-service";
import { WorldModelService } from "@/lib/services/world-model-service";
import { CacheSyncService } from "@/lib/cache/cache-sync-service";

export class PostUnlockSyncService {
  static async run(params: {
    userId: string;
    vaultKey: string;
    vaultOwnerToken: string;
  }): Promise<{
    onboardingSynced: boolean;
    metadataWarmed: boolean;
    financialWarmed: boolean;
  }> {
    const result = {
      onboardingSynced: false,
      metadataWarmed: false,
      financialWarmed: false,
    };

    try {
      const syncResult = await KaiProfileSyncService.syncPendingToVault({
        userId: params.userId,
        vaultKey: params.vaultKey,
        vaultOwnerToken: params.vaultOwnerToken,
      });
      result.onboardingSynced = syncResult.synced;
    } catch (error) {
      console.warn("[PostUnlockSyncService] Pending onboarding sync failed:", error);
    }

    try {
      await WorldModelService.getMetadata(
        params.userId,
        false,
        params.vaultOwnerToken
      );
      result.metadataWarmed = true;
    } catch (error) {
      console.warn("[PostUnlockSyncService] Metadata warm-up failed:", error);
    }

    try {
      const fullBlob = await WorldModelService.loadFullBlob({
        userId: params.userId,
        vaultKey: params.vaultKey,
        vaultOwnerToken: params.vaultOwnerToken,
      });
      const financialRaw = fullBlob?.financial;
      if (financialRaw && typeof financialRaw === "object" && !Array.isArray(financialRaw)) {
        const normalized = normalizeStoredPortfolio(
          financialRaw as Record<string, unknown>
        );
        CacheSyncService.onPortfolioUpserted(params.userId, normalized, {
          invalidateMetadata: false,
        });
        result.financialWarmed = true;
      }
    } catch (error) {
      console.warn("[PostUnlockSyncService] Financial cache warm-up failed:", error);
    }

    return result;
  }
}
