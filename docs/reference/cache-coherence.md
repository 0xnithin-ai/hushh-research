# Cache Coherence Reference

## Purpose

Hushh frontend cache is **memory-only** and deterministic. Every DB-backed mutation must pass through `CacheSyncService` so all views read coherent state without stale data.

Source files:
- `hushh-webapp/lib/services/cache-service.ts`
- `hushh-webapp/lib/cache/cache-sync-service.ts`
- `hushh-webapp/lib/cache/cache-context.tsx`

## Key Taxonomy

Fixed user keys:
- `world_model_metadata_${userId}`
- `world_model_blob_${userId}`
- `vault_status_${userId}`
- `vault_check_${userId}`
- `active_consents_${userId}`
- `pending_consents_${userId}`
- `consent_audit_log_${userId}`
- `portfolio_data_${userId}`

Dynamic user keys:
- `domain_data_${userId}_${domain}`
- `domain_blob_${userId}_${domain}`
- `stock_context_${userId}_${ticker}`

## Mutation -> Cache Sync Matrix

- World model store domain: `CacheSyncService.onWorldModelDomainStored(...)`
- World model clear domain: `CacheSyncService.onWorldModelDomainCleared(...)`
- Portfolio upsert/save: `CacheSyncService.onPortfolioUpserted(...)`
- Vault setup/check state changes: `CacheSyncService.onVaultStateChanged(...)`
- Consent approve/deny/revoke: `CacheSyncService.onConsentMutated(...)`
- Analysis history write/delete: `CacheSyncService.onAnalysisHistoryMutated(...)`
- Sign out: `CacheSyncService.onAuthSignedOut(...)`
- Account delete: `CacheSyncService.onAccountDeleted(...)`

## Sign-out and Delete Purge Policy

- Sign-out should purge all user-scoped cache keys through `onAuthSignedOut(userId)`.
- Account delete should call `onAccountDeleted(userId)` before final sign-out/redirect.
- When user id is unavailable, full cache clear is allowed (`onAuthSignedOut(null)`).

## Rules

Do:
- Centralize invalidation/write-through in `CacheSyncService`.
- Write through encrypted blob keys when CRUD payloads already include ciphertext.
- Patch cached world-model metadata in-place when safe summary fields are provided.
- Keep `CacheContext` as state mirror only.
- Use `invalidateUser(userId)` when purging a full user session.

Don't:
- Add ad-hoc `CacheService.getInstance().invalidate(...)` calls in mutation flows.
- Mix component-level DB mutation and cache operations.

## Verification

Run:
- `cd hushh-webapp && npm run verify:cache`
- `cd hushh-webapp && npm run verify:capacitor:e2e`

The `verify:cache` script hard-fails when critical mutation/auth paths bypass `CacheSyncService`.
