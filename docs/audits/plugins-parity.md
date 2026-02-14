# Capacitor Plugin Parity Audit (iOS / Android / TS)

> **Goal**: Verify every Capacitor plugin exists on iOS + Android, is registered, and has a matching TypeScript `registerPlugin(...)` export.

---

## 1) Inventory (from repo)

### 1.1 iOS plugins (Swift)

Directory: [`hushh-webapp/ios/App/App/Plugins`](../../hushh-webapp/ios/App/App/Plugins:1)

Observed files:

- [`HushhAccountPlugin.swift`](../../hushh-webapp/ios/App/App/Plugins/HushhAccountPlugin.swift:1)
- [`HushhAuthPlugin.swift`](../../hushh-webapp/ios/App/App/Plugins/HushhAuthPlugin.swift:1)
- [`HushhConsentPlugin.swift`](../../hushh-webapp/ios/App/App/Plugins/HushhConsentPlugin.swift:1)
- [`HushhIdentityPlugin.swift`](../../hushh-webapp/ios/App/App/Plugins/HushhIdentityPlugin.swift:1)
- [`HushhKeystorePlugin.swift`](../../hushh-webapp/ios/App/App/Plugins/HushhKeystorePlugin.swift:1)
- [`HushhNotificationsPlugin.swift`](../../hushh-webapp/ios/App/App/Plugins/HushhNotificationsPlugin.swift:1)
- [`HushhSettingsPlugin.swift`](../../hushh-webapp/ios/App/App/Plugins/HushhSettingsPlugin.swift:1)
- [`HushhSyncPlugin.swift`](../../hushh-webapp/ios/App/App/Plugins/HushhSyncPlugin.swift:1)
- [`HushhVaultPlugin.swift`](../../hushh-webapp/ios/App/App/Plugins/HushhVaultPlugin.swift:1)
- [`KaiPlugin.swift`](../../hushh-webapp/ios/App/App/Plugins/KaiPlugin.swift:1)
- [`WorldModelPlugin.swift`](../../hushh-webapp/ios/App/App/Plugins/WorldModelPlugin.swift:1)

Non-plugin helper:

- [`HushhProxyClient.swift`](../../hushh-webapp/ios/App/App/Plugins/HushhProxyClient.swift:1)

Note:

- iOS onboarding exists as `HushhOnboardingPlugin` but is implemented inside [`HushhSyncPlugin.swift`](../../hushh-webapp/ios/App/App/Plugins/HushhSyncPlugin.swift:133) (not a separate file).

### 1.2 Android plugins (Kotlin)

Directory: [`hushh-webapp/android/app/src/main/java/com/hushh/app/plugins`](../../hushh-webapp/android/app/src/main/java/com/hushh/app/plugins:1)

Observed:

- [`HushhAccountPlugin.kt`](../../hushh-webapp/android/app/src/main/java/com/hushh/app/plugins/HushhAccount/HushhAccountPlugin.kt:1)
- [`HushhAuthPlugin.kt`](../../hushh-webapp/android/app/src/main/java/com/hushh/app/plugins/HushhAuth/HushhAuthPlugin.kt:1)
- [`HushhConsentPlugin.kt`](../../hushh-webapp/android/app/src/main/java/com/hushh/app/plugins/HushhConsent/HushhConsentPlugin.kt:1)
- [`HushhIdentityPlugin.kt`](../../hushh-webapp/android/app/src/main/java/com/hushh/app/plugins/HushhIdentity/HushhIdentityPlugin.kt:1)
- [`HushhKeystorePlugin.kt`](../../hushh-webapp/android/app/src/main/java/com/hushh/app/plugins/HushhKeystore/HushhKeystorePlugin.kt:1)
- [`HushhNotificationsPlugin.kt`](../../hushh-webapp/android/app/src/main/java/com/hushh/app/plugins/HushhNotifications/HushhNotificationsPlugin.kt:1)
- [`HushhOnboardingPlugin.kt`](../../hushh-webapp/android/app/src/main/java/com/hushh/app/plugins/HushhOnboarding/HushhOnboardingPlugin.kt:1)
- [`HushhSettingsPlugin.kt`](../../hushh-webapp/android/app/src/main/java/com/hushh/app/plugins/HushhSettings/HushhSettingsPlugin.kt:1)
- [`HushhSyncPlugin.kt`](../../hushh-webapp/android/app/src/main/java/com/hushh/app/plugins/HushhSync/HushhSyncPlugin.kt:1)
- [`HushhVaultPlugin.kt`](../../hushh-webapp/android/app/src/main/java/com/hushh/app/plugins/HushhVault/HushhVaultPlugin.kt:1)
- [`KaiPlugin.kt`](../../hushh-webapp/android/app/src/main/java/com/hushh/app/plugins/Kai/KaiPlugin.kt:1)
- [`WorldModelPlugin.kt`](../../hushh-webapp/android/app/src/main/java/com/hushh/app/plugins/WorldModel/WorldModelPlugin.kt:1)

Shared helper:

- [`BackendUrl.kt`](../../hushh-webapp/android/app/src/main/java/com/hushh/app/plugins/shared/BackendUrl.kt:1)

---

## 2) TypeScript plugin exports

### 2.1 `registerPlugin(...)` exports

- `HushhAuth`: [`registerPlugin("HushhAuth")`](../../hushh-webapp/lib/capacitor/index.ts:104)
- `HushhConsent`: [`registerPlugin("HushhConsent")`](../../hushh-webapp/lib/capacitor/index.ts:222)
- `HushhVault`: [`registerPlugin("HushhVault")`](../../hushh-webapp/lib/capacitor/index.ts:360)
- `HushhKeychain`: [`registerPlugin("HushhKeychain")`](../../hushh-webapp/lib/capacitor/index.ts:406)
- `HushhSettings`: [`registerPlugin("HushhSettings")`](../../hushh-webapp/lib/capacitor/index.ts:440)
- `HushhDatabase`: [`registerPlugin("HushhDatabase")`](../../hushh-webapp/lib/capacitor/index.ts:475)
- `HushhSync`: [`registerPlugin("HushhSync")`](../../hushh-webapp/lib/capacitor/index.ts:584)
- `HushhIdentity`: [`registerPlugin("HushhIdentity")`](../../hushh-webapp/lib/capacitor/index.ts:703)
- `HushhOnboarding`: [`registerPlugin("HushhOnboarding")`](../../hushh-webapp/lib/capacitor/index.ts:741)
- `HushhNotifications`: [`registerPlugin("HushhNotifications")`](../../hushh-webapp/lib/capacitor/index.ts:779)
- `Kai`: [`registerPlugin("Kai")`](../../hushh-webapp/lib/capacitor/kai.ts:263)
- `WorldModel`: [`registerPlugin("WorldModel")`](../../hushh-webapp/lib/capacitor/world-model.ts:215)

### 2.2 Potential drift detected

- `HushhAccount` TS export exists: [`registerPlugin("HushhAccount")`](../../hushh-webapp/lib/capacitor/account.ts:8).

- Android has `HushhOnboardingPlugin.kt`; iOS onboarding exists but is implemented inside [`HushhSyncPlugin.swift`](../../hushh-webapp/ios/App/App/Plugins/HushhSyncPlugin.swift:133).
  - Action: ensure TS export `HushhOnboarding` matches iOS `jsName = "HushhOnboarding"`.

---

## 3) Registration verification (next step)

### 3.1 iOS

Verified registration in [`MyViewController.swift`](../../hushh-webapp/ios/App/App/MyViewController.swift:13):

- `HushhAuth`, `HushhVault`, `HushhConsent`, `HushhIdentity`, `Kai`, `HushhSync`, `HushhSettings`, `HushhKeystore`, `HushhNotifications`, `WorldModel`, `HushhOnboarding`, `HushhAccount`.

### 3.2 Android

Verified registration in [`MainActivity.kt`](../../hushh-webapp/android/app/src/main/java/com/hushh/app/MainActivity.kt:19):

- `HushhAuth`, `HushhVault`, `HushhConsent`, `HushhIdentity`, `HushhSync`, `HushhOnboarding`, `HushhSettings`, `HushhKeystore`, `HushhNotifications`, `Kai`, `WorldModel`, `HushhAccount`.

---

## 4) Acceptance criteria

- Every plugin in iOS/Android has a matching TS `registerPlugin(...)` export.
- Every TS plugin export has a corresponding iOS + Android implementation.
- Every plugin is registered on both platforms.
