#!/usr/bin/env node
/*
 * verify-native-parity.cjs
 *
 * Fast parity check for:
 * - TS plugin registration names
 * - iOS + Android native plugin registration
 * - jsName/name alignment
 * - Key Next.js proxy routes existence (web parity)
 */

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..");
const webappRoot = path.resolve(repoRoot, "hushh-webapp");

function readText(relPath) {
  return fs.readFileSync(path.resolve(repoRoot, relPath), "utf8");
}

function exists(relPath) {
  return fs.existsSync(path.resolve(repoRoot, relPath));
}

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`OK: ${msg}`);
}

const REQUIRED_PLUGINS = [
  // Core plugins
  "HushhAuth",
  "HushhVault",
  "HushhConsent",
  "Kai",
  "HushhSync",
  "HushhSettings",
  "HushhKeychain", // iOS keystore uses jsName HushhKeychain
  "WorldModel",
  // Extra
  "HushhOnboarding",
  "HushhAccount",
  "HushhNotifications",
];

const REQUIRED_WEB_ROUTES = [
  "hushh-webapp/app/api/notifications/register/route.ts",
  "hushh-webapp/app/api/notifications/unregister/route.ts",
  "hushh-webapp/app/api/world-model/get-context/route.ts",
  "hushh-webapp/app/api/kai/[...path]/route.ts",
  "hushh-webapp/app/api/consent/pending/route.ts",
  "hushh-webapp/app/api/consent/revoke/route.ts",
  "hushh-webapp/app/api/onboarding/status/route.ts",
  "hushh-webapp/app/api/onboarding/complete/route.ts",
];

function checkWebRoutes() {
  for (const rel of REQUIRED_WEB_ROUTES) {
    if (!exists(rel)) fail(`Missing Next.js route file: ${rel}`);
  }
  ok("Required Next.js proxy routes exist");
}

function checkTsRegistrations() {
  const ts = readText("hushh-webapp/lib/capacitor/index.ts");
  // Kai is registered in lib/capacitor/kai.ts
  const kaiTs = readText("hushh-webapp/lib/capacitor/kai.ts");
  const worldModelTs = readText("hushh-webapp/lib/capacitor/world-model.ts");
  const accountTs = readText("hushh-webapp/lib/capacitor/account.ts");

  const combined = `${ts}\n${kaiTs}\n${worldModelTs}\n${accountTs}`;

  for (const name of REQUIRED_PLUGINS) {
    if (!combined.includes(`\"${name}\"`) && !combined.includes(`'${name}'`)) {
      fail(`TS does not reference plugin name "${name}" (registerPlugin/export missing?)`);
    }
  }
  ok("TS plugin registration names present");
}

function checkIosRegistration() {
  const vc = readText("hushh-webapp/ios/App/App/MyViewController.swift");
  for (const name of REQUIRED_PLUGINS) {
    // iOS registration uses class instances, but verify list uses plugin(withName:)
    if (!vc.includes(`\"${name}\"`)) {
      fail(`iOS MyViewController.swift does not verify plugin name: ${name}`);
    }
  }
  ok("iOS registration verification list contains all required plugin names");
}

function checkAndroidRegistrationAndNames() {
  const main = readText(
    "hushh-webapp/android/app/src/main/java/com/hushh/app/MainActivity.kt"
  );

  // Ensure each plugin is registered in MainActivity (best-effort string check)
  const expectedClassHints = [
    "HushhAuthPlugin",
    "HushhVaultPlugin",
    "HushhConsentPlugin",
    "KaiPlugin",
    "HushhSyncPlugin",
    "HushhSettingsPlugin",
    "HushhKeystorePlugin",
    "WorldModelPlugin",
    "HushhOnboardingPlugin",
    "HushhAccountPlugin",
    "HushhNotificationsPlugin",
  ];

  for (const hint of expectedClassHints) {
    if (!main.includes(hint)) {
      fail(`Android MainActivity.kt missing plugin registration/import: ${hint}`);
    }
  }

  // Ensure @CapacitorPlugin name alignment for selected plugins
  const androidPluginFiles = [
    "hushh-webapp/android/app/src/main/java/com/hushh/app/plugins/HushhNotifications/HushhNotificationsPlugin.kt",
    "hushh-webapp/android/app/src/main/java/com/hushh/app/plugins/HushhOnboarding/HushhOnboardingPlugin.kt",
    "hushh-webapp/android/app/src/main/java/com/hushh/app/plugins/HushhAccount/HushhAccountPlugin.kt",
    "hushh-webapp/android/app/src/main/java/com/hushh/app/plugins/WorldModel/WorldModelPlugin.kt",
    "hushh-webapp/android/app/src/main/java/com/hushh/app/plugins/Kai/KaiPlugin.kt",
  ];

  for (const rel of androidPluginFiles) {
    if (!exists(rel)) {
      fail(`Missing Android plugin file: ${rel}`);
      continue;
    }
    const txt = readText(rel);
    const match = txt.match(/@CapacitorPlugin\(name\s*=\s*\"([^\"]+)\"\)/);
    if (!match) {
      fail(`Android plugin missing @CapacitorPlugin(name=...): ${rel}`);
      continue;
    }
    const name = match[1];
    if (!REQUIRED_PLUGINS.includes(name)) {
      fail(`Android plugin name not in required list: ${name} (${rel})`);
    }
  }

  ok("Android plugin registrations and @CapacitorPlugin names look consistent");
}

function main() {
  checkWebRoutes();
  checkTsRegistrations();
  checkIosRegistration();
  checkAndroidRegistrationAndNames();

  if (process.exitCode) {
    console.error("\nParity check FAILED");
    process.exit(1);
  }
  console.log("\nParity check PASSED");
}

main();
