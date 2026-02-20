import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.fn();

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}));

vi.mock("@/lib/capacitor", () => ({
  HushhWorldModel: {},
}));

vi.mock("@/lib/services/api-service", () => ({
  ApiService: {
    apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  },
}));

import { CacheSyncService } from "@/lib/cache/cache-sync-service";
import { CacheService, CACHE_KEYS } from "@/lib/services/cache-service";
import { WorldModelService } from "@/lib/services/world-model-service";

describe("World model cache behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    CacheService.getInstance().clear();
  });

  it("dedupes concurrent metadata fetches", async () => {
    apiFetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          user_id: "user-1",
          domains: [],
          total_attributes: 0,
          model_completeness: 0,
          suggested_domains: [],
          last_updated: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const [a, b] = await Promise.all([
      WorldModelService.getMetadata("user-1", false, "vault-owner-token"),
      WorldModelService.getMetadata("user-1", false, "vault-owner-token"),
    ]);

    expect(a.userId).toBe("user-1");
    expect(b.userId).toBe("user-1");
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it("reads encrypted user/domain blobs from cache on subsequent calls", async () => {
    apiFetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/api/world-model/data/user-1")) {
        return new Response(
          JSON.stringify({
            ciphertext: "ciphertext-user",
            iv: "iv-user",
            tag: "tag-user",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/world-model/domain-data/user-1/financial")) {
        return new Response(
          JSON.stringify({
            encrypted_blob: {
              ciphertext: "ciphertext-domain",
              iv: "iv-domain",
              tag: "tag-domain",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("not found", { status: 404 });
    });

    const blobFirst = await WorldModelService.getEncryptedData("user-1", "vault-owner-token");
    const blobSecond = await WorldModelService.getEncryptedData("user-1", "vault-owner-token");
    expect(blobFirst?.ciphertext).toBe("ciphertext-user");
    expect(blobSecond?.ciphertext).toBe("ciphertext-user");

    const domainFirst = await WorldModelService.getDomainData(
      "user-1",
      "financial",
      "vault-owner-token"
    );
    const domainSecond = await WorldModelService.getDomainData(
      "user-1",
      "financial",
      "vault-owner-token"
    );
    expect(domainFirst?.ciphertext).toBe("ciphertext-domain");
    expect(domainSecond?.ciphertext).toBe("ciphertext-domain");

    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });

  it("writes through and invalidates cache keys on world model CRUD sync hooks", () => {
    const cache = CacheService.getInstance();
    const userId = "user-1";

    cache.set(CACHE_KEYS.WORLD_MODEL_METADATA(userId), {
      userId,
      domains: [],
      totalAttributes: 0,
      modelCompleteness: 0,
      suggestedDomains: [],
      lastUpdated: null,
    });

    CacheSyncService.onWorldModelDomainStored(userId, "financial", {
      portfolioData: {
        holdings: [{ symbol: "AAPL", name: "Apple", quantity: 10, price: 100, market_value: 1000 }],
      },
      encryptedBlob: {
        ciphertext: "cipher-blob",
        iv: "iv-blob",
        tag: "tag-blob",
      },
      domainSummary: {
        domain_key: "financial",
        holdings_count: 1,
      },
    });

    expect(cache.get(CACHE_KEYS.PORTFOLIO_DATA(userId))).toBeTruthy();
    expect(cache.get(CACHE_KEYS.WORLD_MODEL_BLOB(userId))).toBeTruthy();
    expect(cache.get(CACHE_KEYS.ENCRYPTED_DOMAIN_BLOB(userId, "financial"))).toBeTruthy();
    expect(cache.get(CACHE_KEYS.WORLD_MODEL_METADATA(userId))).toBeTruthy();

    CacheSyncService.onPortfolioUpserted(
      userId,
      { holdings: [{ symbol: "MSFT", name: "Microsoft", quantity: 3, price: 10, market_value: 30 }] },
      { invalidateMetadata: false }
    );
    expect(cache.get(CACHE_KEYS.WORLD_MODEL_METADATA(userId))).toBeTruthy();

    CacheSyncService.onWorldModelDomainCleared(userId, "financial");
    expect(cache.get(CACHE_KEYS.PORTFOLIO_DATA(userId))).toBeNull();
    expect(cache.get(CACHE_KEYS.WORLD_MODEL_BLOB(userId))).toBeNull();
    expect(cache.get(CACHE_KEYS.ENCRYPTED_DOMAIN_BLOB(userId, "financial"))).toBeNull();
    expect(cache.get(CACHE_KEYS.WORLD_MODEL_METADATA(userId))).toBeNull();
  });
});
