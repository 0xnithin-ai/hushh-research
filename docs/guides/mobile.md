# Mobile Development (iOS & Android)

> Native mobile deployment with Capacitor 8 and local-first architecture.
> Last verified: January 2026.

---

## Overview

The Hushh mobile app uses **Next.js static export** in a native WebView, with **8 native plugins** handling security-critical operations. Both iOS and Android achieve feature parity through aligned plugin implementations.

### Dev mode (hot reload) vs plugin parity

- The **WebView UI** can point to a running `next dev` server for hot reload.
- **Native plugins must always call the Python backend** (FastAPI) via `NEXT_PUBLIC_BACKEND_URL` for parity with production.
- Next.js `app/api/**` routes are treated as **web-only proxy routes**; native plugins are the proxy layer on mobile.

Recommended commands (from `hushh-webapp`):

- Terminal A: `npm run dev`
- Terminal B:
  - Android: `npm run cap:android:dev:run`
  - iOS: `npm run cap:ios:dev:run`

Required env:

- `NEXT_PUBLIC_BACKEND_URL` must point to your dev/staging Python backend.
  - If you use a local backend on your host machine, remember Android emulator needs `10.0.2.2` instead of `localhost`.

```
┌────────────────────────────────────────────────────────────────┐
│              CAPACITOR MOBILE APP (iOS/Android)                │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Native WebView (Next.js Static Export)         │  │
│  │  • React 19 + TailwindCSS UI                             │  │
│  │  • Morphy-UX components                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓ Capacitor.call()                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │        Native Plugins (8 per platform)                    │  │
│  │  HushhAuth · HushhVault · HushhConsent · HushhIdentity   │  │
│  │  Kai · HushhSync · HushhSettings · HushhKeystore         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓ Native HTTP                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          Python Backend (Cloud Run)                       │  │
│  │  consent-protocol FastAPI with PostgreSQL                │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## Native Plugins (8 Verified)

All 8 plugins exist on both platforms with matching methods:

| Plugin            | jsName          | Purpose                        | iOS                         | Android                  |
| ----------------- | --------------- | ------------------------------ | --------------------------- | ------------------------ |
| **HushhAuth**     | `HushhAuth`     | Google/Apple Sign-In, Firebase | `HushhAuthPlugin.swift`     | `HushhAuthPlugin.kt`     |
| **HushhVault**    | `HushhVault`    | Encryption, vault operations   | `HushhVaultPlugin.swift`    | `HushhVaultPlugin.kt`    |
| **HushhConsent**  | `HushhConsent`  | Token management, consent flow | `HushhConsentPlugin.swift`  | `HushhConsentPlugin.kt`  |
| **HushhIdentity** | `HushhIdentity` | Investor identity resolution   | `HushhIdentityPlugin.swift` | `HushhIdentityPlugin.kt` |
| **Kai**           | `Kai`           | Investment analysis agent      | `KaiPlugin.swift`           | `KaiPlugin.kt`           |
| **HushhSync**     | `HushhSync`     | Cloud synchronization          | `HushhSyncPlugin.swift`     | `HushhSyncPlugin.kt`     |
| **HushhSettings** | `HushhSettings` | App preferences                | `HushhSettingsPlugin.swift` | `HushhSettingsPlugin.kt` |
| **HushhKeystore** | `HushhKeychain` | Secure key storage             | `HushhKeystorePlugin.swift` | `HushhKeystorePlugin.kt` |

> Note: HushhKeystore uses jsName `HushhKeychain` for historical compatibility.

---

## Key Methods by Plugin

### HushhAuth

| Method               | Description                                           |
| -------------------- | ----------------------------------------------------- |
| `signInWithGoogle()` | Native Google Sign-In → Firebase credential           |
| `signInWithApple()`  | Native Apple Sign-In (iOS) / Firebase OAuth (Android) |
| `signOut()`          | Clear all auth state                                  |
| `getIdToken()`       | Get cached/fresh Firebase ID token                    |
| `getCurrentUser()`   | Get user profile                                      |
| `isSignedIn()`       | Check auth state                                      |

### HushhVault

| Method                   | Description                      |
| ------------------------ | -------------------------------- |
| `hasVault()`             | Check if vault exists for user   |
| `getVault()`             | Get vault status                 |
| `setupVault()`           | Initialize user vault            |
| `getFoodPreferences()`   | Get encrypted food preferences   |
| `storeFoodPreferences()` | Store encrypted food preferences |
| `getProfessionalData()`  | Get encrypted professional data  |

### HushhConsent

| Method                   | Description                            |
| ------------------------ | -------------------------------------- |
| `issueToken()`           | Issue consent token locally            |
| `validateToken()`        | Validate token signature/expiry        |
| `revokeToken()`          | Revoke consent token                   |
| `issueVaultOwnerToken()` | Request VAULT_OWNER token from backend |
| `getPending()`           | Get pending consent requests           |
| `getActive()`            | Get active consents                    |
| `getHistory()`           | Get consent audit history              |
| `approve()`              | Approve pending consent                |
| `deny()`                 | Deny pending consent                   |
| `createTrustLink()`      | Create A2A delegation link             |
| `verifyTrustLink()`      | Verify TrustLink signature             |

### HushhIdentity

| Method                  | Description                    |
| ----------------------- | ------------------------------ |
| `searchInvestors()`     | Search investor profiles       |
| `getInvestor()`         | Get investor by ID             |
| `syncInvestorProfile()` | Sync investor profile to vault |

### Kai

| Method                 | Description               |
| ---------------------- | ------------------------- |
| `analyze()`            | Start investment analysis |
| `getDecisionHistory()` | Get past decisions        |
| `stream()`             | Stream analysis with SSE  |

### HushhSync

| Method            | Description              |
| ----------------- | ------------------------ |
| `syncToCloud()`   | Sync local data to cloud |
| `syncFromCloud()` | Pull data from cloud     |

### HushhSettings

| Method                  | Description             |
| ----------------------- | ----------------------- |
| `get()`                 | Get setting value       |
| `set()`                 | Set setting value       |
| `remove()`              | Remove setting          |
| `getCloudSyncEnabled()` | Check cloud sync status |

### HushhKeystore (jsName: HushhKeychain)

| Method               | Description           |
| -------------------- | --------------------- |
| `setSecureItem()`    | Store secure value    |
| `getSecureItem()`    | Retrieve secure value |
| `removeSecureItem()` | Delete secure value   |

---

## File Structure

### iOS

```
ios/App/App/
├── AppDelegate.swift           # Firebase.configure()
├── MyViewController.swift      # Plugin registration
└── Plugins/
    ├── HushhAuthPlugin.swift
    ├── HushhVaultPlugin.swift
    ├── HushhConsentPlugin.swift
    ├── HushhIdentityPlugin.swift
    ├── KaiPlugin.swift
    ├── HushhSyncPlugin.swift
    ├── HushhSettingsPlugin.swift
    └── HushhKeystorePlugin.swift
```

### Android

```
android/app/src/main/java/com/hushh/app/
├── MainActivity.kt             # Plugin registration
└── plugins/
    ├── HushhAuth/HushhAuthPlugin.kt
    ├── HushhVault/HushhVaultPlugin.kt
    ├── HushhConsent/HushhConsentPlugin.kt
    ├── HushhIdentity/HushhIdentityPlugin.kt
    ├── Kai/KaiPlugin.kt
    ├── HushhSync/HushhSyncPlugin.kt
    ├── HushhSettings/HushhSettingsPlugin.kt
    └── HushhKeystore/HushhKeystorePlugin.kt
```

### TypeScript Layer

```
lib/
├── capacitor/
│   ├── index.ts          # Plugin registration & interfaces
│   ├── types.ts          # Type definitions
│   └── plugins/          # Web fallbacks
│       ├── auth-web.ts
│       ├── vault-web.ts
│       ├── consent-web.ts
│       ├── identity-web.ts
│       ├── kai-web.ts
│       ├── sync-web.ts
│       ├── settings-web.ts
│       └── keychain-web.ts
└── services/
    ├── api-service.ts    # Platform-aware API routing
    ├── auth-service.ts   # Native auth abstraction
    ├── vault-service.ts  # Vault operations
    └── kai-service.ts    # Kai agent service
```

---

## Plugin Registration

Every plugin must be registered in **both** iOS and Android registration files. Missing registration causes silent runtime failures when TypeScript calls the plugin on native platforms.

### iOS (Capacitor 8)

```swift
// ios/App/App/MyViewController.swift
class MyViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(HushhAuthPlugin())
        bridge?.registerPluginInstance(HushhVaultPlugin())
        bridge?.registerPluginInstance(HushhConsentPlugin())
        bridge?.registerPluginInstance(HushhIdentityPlugin())
        bridge?.registerPluginInstance(KaiPlugin())
        bridge?.registerPluginInstance(HushhSyncPlugin())
        bridge?.registerPluginInstance(HushhSettingsPlugin())
        bridge?.registerPluginInstance(HushhKeystorePlugin())
        bridge?.registerPluginInstance(WorldModelPlugin())
    }
}
```

### Adding new iOS source files (project.pbxproj)

When adding a new Swift file to the app (e.g. a new plugin), you must add it to the Xcode project. If you edit `ios/App/App.xcodeproj/project.pbxproj` manually:

- **Every file reference and build file ID must be exactly 24 hexadecimal characters** (`0-9`, `A-F` only). No other characters are valid.
- Invalid IDs (e.g. containing `W`, `M`, `P`, `L`, `U`, `G`) cause Xcode errors like **"invalid hex digit"** and prevent the project from loading or building.
- Each new source file needs: (1) a `PBXFileReference` with a 24-hex ID, and (2) a `PBXBuildFile` entry in the app target’s Sources phase with a different 24-hex ID. Add the file reference to the Plugins group and the build file to the Sources build phase.
- Prefer adding the file in Xcode (File → Add Files) so it generates valid IDs; if editing `project.pbxproj` by hand, copy the ID format from existing entries (e.g. `A1B2C3D42F0E966A009FC3FD`).

### Android

```kotlin
// android/app/src/main/java/com/hushh/app/MainActivity.kt
class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(HushhAuthPlugin::class.java)
        registerPlugin(HushhVaultPlugin::class.java)
        registerPlugin(HushhConsentPlugin::class.java)
        registerPlugin(HushhIdentityPlugin::class.java)
        registerPlugin(KaiPlugin::class.java)
        registerPlugin(HushhSyncPlugin::class.java)
        registerPlugin(HushhSettingsPlugin::class.java)
        registerPlugin(HushhKeystorePlugin::class.java)
        registerPlugin(WorldModelPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
```

---

## Platform Comparison

| Feature           | Web         | iOS Native      | Android Native |
| ----------------- | ----------- | --------------- | -------------- |
| **Cloud Vault**   | Yes         | Yes             | Yes            |
| **Sign-In**       | Firebase JS | HushhAuth.swift | HushhAuth.kt   |
| **HTTP Client**   | fetch()     | URLSession      | OkHttpClient   |
| **Vault Storage** | Web Crypto  | Keychain        | Keystore       |
| **Biometric**     | No          | FaceID/TouchID  | Fingerprint    |

---

## Service Abstraction Pattern

TypeScript services route to native plugins or web APIs based on platform:

```typescript
// lib/services/vault-service.ts
import { Capacitor } from "@capacitor/core";
import { HushhVault } from "@/lib/capacitor";

export class VaultService {
  static async getFoodPreferences(userId: string): Promise<FoodPreferences> {
    if (Capacitor.isNativePlatform()) {
      // Native: Use Capacitor plugin → calls Python backend directly
      return HushhVault.getFoodPreferences({ userId });
    }
    // Web: Use Next.js API route
    return apiFetch(`/api/vault/food/preferences?userId=${userId}`);
  }
}
```

---

## snake_case to camelCase Transformation (CRITICAL)

Native plugins (iOS/Android) call the Python backend directly and receive raw JSON responses with **snake_case** keys. The service layer MUST transform these to **camelCase** before returning to React components.

### Why This Is Required

- Python backend uses snake_case (PEP 8 convention)
- TypeScript/React uses camelCase (JavaScript convention)
- Native plugins pass through raw JSON without transformation
- Web proxy routes (Next.js) also return snake_case from backend

### Required Pattern

```typescript
// lib/services/example-service.ts
if (Capacitor.isNativePlatform()) {
  const nativeResult = await Plugin.method({ userId });
  // Transform snake_case to camelCase
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = nativeResult as any;
  return {
    userId: raw.user_id || raw.userId,
    displayName: raw.display_name || raw.displayName,
    totalCount: raw.total_count || raw.totalCount || 0,
  };
}
```

### Plugins Requiring Transformation

| Plugin     | Methods                                                                     | Status                    |
| ---------- | --------------------------------------------------------------------------- | ------------------------- |
| WorldModel | getMetadata, getAttributes, getUserDomains, listDomains, getAvailableScopes | Required                  |
| Kai        | getInitialChatState, chat                                                   | Required                  |
| Identity   | autoDetect, getIdentityStatus, getEncryptedProfile                          | Required                  |
| Vault      | All crypto methods                                                          | Not needed (simple types) |
| Consent    | Token methods                                                               | Not needed (simple types) |

---

## API Routes Require Native Plugins

> **IMPORTANT:** Every Next.js `/api` route that needs to work on iOS/Android MUST have a corresponding native Capacitor plugin implementation.

### Why This Is Required

Next.js `/api` routes run on a Node.js server. When the app is deployed as a Capacitor native app, there is **no server** - the app is a static bundle in a WebView:

```
❌ Native: fetch("/api/vault/food") → FAILS - No server available!
✅ Native: HushhVault.getFoodPreferences() → Native plugin → Python backend
```

### Mandatory 5-Step Workflow

When adding any new API feature:

| Step | Location                      | Action                              |
| ---- | ----------------------------- | ----------------------------------- |
| 1    | `app/api/.../route.ts`        | Create Next.js API route (web only) |
| 2    | `lib/capacitor/index.ts`      | Add TypeScript interface            |
| 3    | `android/.../Plugin.kt`       | Implement Kotlin method             |
| 4    | `ios/.../Plugin.swift`        | Implement Swift method              |
| 5    | `lib/services/...-service.ts` | Add platform-aware routing          |

### Platform-Aware ApiService Pattern

```typescript
// lib/services/api-service.ts
import { Capacitor } from "@capacitor/core";

export class ApiService {
  static async approvePendingConsent(data: {
    userId: string;
    requestId: string;
  }): Promise<Response> {
    if (Capacitor.isNativePlatform()) {
      // Native: Use Capacitor plugin → calls Python backend directly
      const { HushhConsent } = await import("@/lib/capacitor");
      await HushhConsent.approve({
        requestId: data.requestId,
        userId: data.userId,
      });
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    // Web: Use Next.js API route
    return fetch("/api/consent/pending/approve", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}
```

---

## Endpoint Mapping

Native plugins call Python backend directly, bypassing Next.js:

| Operation        | Native (Swift/Kotlin)                | Web (Next.js)                             | Backend |
| ---------------- | ------------------------------------ | ----------------------------------------- | ------- |
| Vault Check      | `POST /db/vault/check`               | `GET /api/vault/check`                    | Python  |
| Vault Get        | `POST /db/vault/get`                 | `GET /api/vault/get`                      | Python  |
| Vault Setup      | `POST /db/vault/setup`               | `POST /api/vault/setup`                   | Python  |
| Food Get         | `POST /api/food/preferences`         | `GET /api/vault/food/preferences`         | Python  |
| Professional Get | `POST /api/professional/preferences` | `GET /api/vault/professional/preferences` | Python  |
| Consent Pending  | `POST /api/consent/pending`          | `GET /api/consent/pending`                | Python  |
| Consent Active   | `POST /api/consent/active`           | `GET /api/consent/active`                 | Python  |
| Consent History  | `POST /api/consent/history`          | `GET /api/consent/history`                | Python  |

### Backend URLs

| Mode       | URL                                                          |
| ---------- | ------------------------------------------------------------ |
| Production | `https://consent-protocol-1006304528804.us-central1.run.app` |
| Local Dev  | `http://localhost:8080`                                      |

Native plugins have `defaultBackendUrl` hardcoded to production. For local testing, pass `backendUrl` parameter.

---

## Build Commands

> **IMPORTANT:** ALWAYS perform a fresh build when modifying native code (Swift/Kotlin plugins).
> Stale DerivedData will cause native changes to be ignored.

### iOS (Fresh Build)

```bash
# 1. Clear Xcode cache (MANDATORY for native changes)
rm -rf ~/Library/Developer/Xcode/DerivedData/App-*

# 2. Build web assets and sync
npm run cap:build
npx cap sync ios

# 3. Clean build
xcodebuild -project ios/App/App.xcodeproj -scheme App clean build \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  -derivedDataPath ~/Library/Developer/Xcode/DerivedData/App-hushh

# 4. Install and launch
xcrun simctl install booted ~/Library/Developer/Xcode/DerivedData/App-hushh/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted com.hushh.app
```

### Android (Fresh Build)

> **IMPORTANT:** Ensure `.env.local` contains the Production backend URL.
> `capacitor.config.ts` is configured to load this file.

```bash
# 1. Clean Gradle cache
cd android && ./gradlew clean && cd ..

# 2. Build web assets and sync
cross-env CAPACITOR_BUILD=true npm run build
npx cap sync android

# 3. Build and install
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

---

## Build Configuration

### next.config.ts

```typescript
// Web/Cloud Run: undefined (server mode with API routes)
// Capacitor/Mobile: "export" (static HTML, no API routes)
output: isCapacitorBuild ? "export" : undefined;
```

### capacitor.config.ts

```typescript
// For development: set to true to use localhost:3000 hot reload
// For production: set to false to use static build in /out
const DEV_MODE = false; // Must be false for production builds

const config: CapacitorConfig = {
  appId: "com.hushh.app",
  appName: "Hushh",
  webDir: "out",
  server: {
    cleartext: true,
    androidScheme: "https",
  },
};
```

**Production Checklist:**

- [ ] Set `DEV_MODE = false` in `capacitor.config.ts`
- [ ] Run `npm run cap:build` to create static export
- [ ] Run `npx cap sync` to copy assets to native projects
- [ ] Verify `capacitor.config.json` in native assets has no `url` in `server` section

---

## Device Requirements

| Requirement    | iOS     | Android              |
| -------------- | ------- | -------------------- |
| **Minimum OS** | iOS 16+ | Android 11+ (API 30) |
| **Target OS**  | iOS 18  | Android 14+          |

---

## Mobile UX Standards

### Navigation Architecture

The app follows a **Layered Navigation** model:

| Level  | Description | Examples                      | Back Button        |
| ------ | ----------- | ----------------------------- | ------------------ |
| **1**  | Root Pages  | `/dashboard`, `/profile`      | Exit App Dialog    |
| **2+** | Sub Pages   | `/dashboard/kai`, `/settings` | Navigate to Parent |

### Exit Dialog Security

When users exit from root-level pages:

1. User clicks back button on root page
2. `NavigationProvider` detects `isRootLevel = true`
3. `ExitDialog` appears with security warning
4. On confirm:
   - Lock vault (clear encryption key from memory)
   - Clear session storage
   - Remove sensitive localStorage items
   - Exit app via Capacitor

### Layout & Safe Area

**Top bar (native and web):**

- **StatusBarBlur** (native only): Fixed strip under the system status bar with height `env(safe-area-inset-top)`; uses the same glass style as the breadcrumb bar so both bands match.
- **TopAppBar**: Fixed breadcrumb bar; height **64px**; on native sits below StatusBarBlur at `top: env(safe-area-inset-top)`.
- Both use the **masked blur** style (`.top-bar-glass`): theme-aware semi-transparent background, `backdrop-filter: blur(3px) saturate(180%)`, and a faded bottom edge via `mask-image` so the bar blends into the content.
- **No spacer in layout**: The main scroll container in `Providers` has `pt-[45px]` and extends under the fixed bar so content can scroll behind it; body already has `padding-top: env(safe-area-inset-top)` for the notch/safe area.
- **TopAppBarSpacer** is no longer used in the root layout; the scroll container’s padding provides clearance. The component remains available if a page needs to reserve space for the bar outside the main providers layout.

---

## Roadmap: On-Device AI Layer

> **Vision**: Run AI directly on the device for maximum privacy - no cloud required.

### Architecture Overview (Planned)

```
┌────────────────────────────────────────────────────────────────┐
│              ON-DEVICE AI LAYER (Future Implementation)         │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 LOCAL AI INFERENCE                        │  │
│  │  iOS: MLX Framework (Apple Silicon optimized)            │  │
│  │  Android: MediaPipe + Gemma (LLM Inference API)          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓ Local Processing                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 LOCAL MCP SERVER                          │  │
│  │  HushhMCPPlugin - JSON-RPC 2.0 interface                 │  │
│  │  Exposes vault data to system AI with consent            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓ Local SQLite                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          LOCAL ENCRYPTED VAULT (SQLite + Room)            │  │
│  │  Data NEVER leaves device unless user opts-in             │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### Implementation Roadmap

| Phase       | Feature               | iOS                | Android           | Status     |
| ----------- | --------------------- | ------------------ | ----------------- | ---------- |
| **Phase 1** | Local SQLite Vault    | CoreData           | Room              | 🔜 Planned |
| **Phase 2** | Local MCP Server      | HushhMCPPlugin     | HushhMCPPlugin    | 🔜 Planned |
| **Phase 3** | On-Device LLM         | MLX Framework      | MediaPipe + Gemma | 🔜 Planned |
| **Phase 4** | System AI Integration | Apple Intelligence | Gemini / AICore   | 🔜 Planned |

### On-Device AI Options

| Option                   | Platform    | Pros                                       | Cons                              |
| ------------------------ | ----------- | ------------------------------------------ | --------------------------------- |
| **Apple Intelligence**   | iOS 18+     | Native, no model download, optimized       | Limited to iOS 18+ devices        |
| **MLX Swift**            | iOS         | Full control, custom models, Apple Silicon | Requires model packaging (~1.5GB) |
| **MediaPipe + Gemma**    | Android     | Google-supported, well-documented          | Large model downloads (~1.5GB)    |
| **Gemini Nano (AICore)** | Android 14+ | Native, optimized                          | Limited device availability       |
| **@capgo/capacitor-llm** | Both        | Ready-made plugin, cross-platform          | Less customization                |

### Why On-Device AI Matters

1. **True Zero-Knowledge**: Data never leaves the device, not even encrypted
2. **Offline Capability**: Full AI functionality without internet
3. **System AI Integration**: "Hey Siri, what should I invest in?" with consent
4. **Lower Latency**: No network round-trips for AI inference
5. **Cost Efficiency**: No cloud compute costs for inference

### Example: Future Siri Integration

```
User: "Hey Siri, what should I have for dinner based on my preferences?"

┌──────────────────────────────────────────────────────────────────────┐
│ 1. Siri → Apple Intelligence → Detects Hushh integration            │
│ 2. Apple Intelligence → HushhMCP.request_consent("vault.read.food") │
│ 3. HushhMCP → Prompt user with FaceID consent                        │
│ 4. User approves → Consent token issued locally                      │
│ 5. HushhMCP.get_food_preferences(token) → Local SQLite               │
│ 6. Returns: {vegetarian: true, budget: $30}                          │
│ 7. Apple Intelligence → Uses context for response                    │
│ 8. Siri: "Based on your preferences, here are vegetarian options..." │
│                                                                       │
│ ⚠️ NO DATA EVER LEFT THE DEVICE                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Device Requirements (Future)

| Requirement                | iOS                    | Android                 |
| -------------------------- | ---------------------- | ----------------------- |
| **Minimum for Local AI**   | A14+ chip (iPhone 12+) | 4GB+ RAM                |
| **For Apple Intelligence** | iOS 18+                | N/A                     |
| **For Gemini Nano**        | N/A                    | Android 14+ with AICore |

### Plugin Stub (Ready for Implementation)

```typescript
// lib/capacitor/index.ts (Interface ready, implementation pending)
export interface HushhAIPlugin {
  generateResponse(options: { prompt: string }): Promise<{ response: string }>;
  isAvailable(): Promise<{ available: boolean }>;
  downloadModel?(): Promise<{ status: string; progress?: number }>;
}

export interface HushhMCPPlugin {
  startServer(): Promise<{ port: number }>;
  stopServer(): Promise<void>;
  registerWithSystemAI(): Promise<{ registered: boolean }>;
  handleToolCall(request: MCPRequest): Promise<MCPResponse>;
}
```

---

## Authentication Token Passing

**CRITICAL:** When components call services that require `vaultOwnerToken`, always pass it explicitly as a prop. Do not rely on sessionStorage fallback on native platforms.

```typescript
// Component receives vaultOwnerToken from context
const { vaultOwnerToken } = useVault();

// Pass to child components
<PortfolioReviewView
  vaultOwnerToken={vaultOwnerToken}
  // ... other props
/>

// Service call includes token
await WorldModelService.storeDomainData({
  userId,
  domain: "financial",
  encryptedBlob: { ... },
  summary: { ... },
  vaultOwnerToken, // Explicitly passed
});
```

**Why:** Native platforms may not have reliable sessionStorage access, and the service layer's fallback (`sessionStorage.getItem("vault_owner_token")`) may return `undefined`, causing authentication failures.

## Streaming Features

For Server-Sent Events (SSE) streaming on native:

- Use native plugins that emit events via `notifyListeners()`
- ApiService creates ReadableStream fed by plugin events
- Components process buffer after stream ends to catch final events
- See [Native Streaming Guide](./native_streaming.md) for complete patterns

## Testing Checklist

Before releasing mobile updates:

- [ ] All 8 plugins registered on both platforms
- [ ] Firebase authentication works (Google Sign-In)
- [ ] Apple Sign-In works on iOS
- [ ] Vault operations work end-to-end
- [ ] Consent flow completes successfully
- [ ] Kai analysis streams correctly
- [ ] Streaming features complete and show results
- [ ] Save to vault works (vaultOwnerToken passed correctly)
- [ ] Backend URLs point to production
- [ ] Biometric prompts work correctly

---

_Last verified: February 2026 | Capacitor 8_
