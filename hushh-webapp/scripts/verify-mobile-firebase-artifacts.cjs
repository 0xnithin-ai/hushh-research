#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const androidPath = path.join(
  repoRoot,
  "hushh-webapp",
  "android",
  "app",
  "google-services.json"
);
const iosPath = path.join(
  repoRoot,
  "hushh-webapp",
  "ios",
  "App",
  "App",
  "GoogleService-Info.plist"
);

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`INFO: ${message}`);
}

function readFile(filePath) {
  if (!fs.existsSync(filePath)) fail(`Missing required file: ${filePath}`);
  return fs.readFileSync(filePath, "utf8");
}

function hasTemplateMarker(text) {
  return /__FIREBASE_[A-Z0-9_]+__/.test(text);
}

function validateAndroidJson(text) {
  try {
    JSON.parse(text);
  } catch (error) {
    fail(`Invalid JSON in google-services.json: ${String(error)}`);
  }
}

function main() {
  const requireProdArtifacts =
    String(process.env.REQUIRE_PROD_FIREBASE_ARTIFACTS || "").toLowerCase() === "true";

  const androidText = readFile(androidPath);
  const iosText = readFile(iosPath);

  validateAndroidJson(androidText);

  const androidIsTemplate = hasTemplateMarker(androidText);
  const iosIsTemplate = hasTemplateMarker(iosText);

  if (!requireProdArtifacts) {
    if (!androidIsTemplate || !iosIsTemplate) {
      fail(
        "Committed mobile Firebase artifacts must be template placeholders. Replace production artifacts with templates."
      );
    }
    info("Template Firebase mobile artifacts are present (expected for source control).");
    return;
  }

  if (androidIsTemplate || iosIsTemplate) {
    fail(
      "Production mobile Firebase artifacts were not injected. Set CI secrets and overwrite template files before release build."
    );
  }

  info("Production Firebase mobile artifacts detected (release check passed).");
}

main();
